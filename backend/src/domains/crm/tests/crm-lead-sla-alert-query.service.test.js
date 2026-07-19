const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadSlaAlertQueryService,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeAlertCursor,
  normalizeFilters,
} = require("../application/crm-lead-sla-alert-query.service.js");
const { CrmLeadSlaAlertMetrics } = require("../application/crm-lead-sla-alert-metrics.js");
const { encodeCursor: encodeLeadCursor } = require("../application/crm-lead-query.service.js");

const MEASURED_AT = "2026-07-18T12:00:00.000Z";

function sourceItem(id, slaStatus, overrides = {}) {
  const stage = overrides.stage || (slaStatus === "COMPLETED" ? "WON" : "NEW");
  const unavailable = slaStatus === "UNAVAILABLE";
  const elapsedMs = unavailable ? null : (overrides.elapsedMs ?? 1_000);
  const limitMs = ["NOT_CONFIGURED", "COMPLETED"].includes(slaStatus)
    ? null
    : (overrides.limitMs ?? 2_000);
  return {
    assignedTo: "operator-1",
    contact: { email: "person@example.com", nome: "PII", telefone: "5511999999999" },
    id,
    metadata: { cpf: "52998224725" },
    reason: "sensitive reason",
    stage,
    stageTiming: {
      currentStageElapsedMs: elapsedMs,
      currentStageEntryAt: unavailable ? null : overrides.entryAt || "2026-07-18T10:00:00.000Z",
      historyCoverage: overrides.historyCoverage || (unavailable ? "UNAVAILABLE" : "COMPLETE"),
      measuredAt: MEASURED_AT,
      sla: {
        consumedPercentage:
          limitMs == null || elapsedMs == null ? null : Math.min(100, (elapsedMs / limitMs) * 100),
        elapsedMs,
        limitMs,
        overdueMs: slaStatus === "OVERDUE" ? (overrides.overdueMs ?? 500) : 0,
        remainingMs:
          slaStatus === "DUE_SOON" || slaStatus === "ON_TRACK"
            ? (overrides.remainingMs ?? 500)
            : limitMs,
        status: slaStatus,
      },
    },
    status: stage === "WON" ? "CONVERTED" : "OPEN",
    unitId: "unit-1",
    updatedAt: "2026-07-18T11:00:00.000Z",
    ...overrides.item,
  };
}

function makeService({ pages = [], logger = null, metrics = null, onList = null } = {}) {
  let index = 0;
  const calls = [];
  const service = new CrmLeadSlaAlertQueryService({
    leadQueryService: {
      async listLeads(filters) {
        calls.push(filters);
        onList?.(filters);
        const page = pages[Math.min(index, Math.max(0, pages.length - 1))] || {
          items: [],
          pageInfo: { hasNextPage: false, nextCursor: null },
        };
        index += 1;
        return page;
      },
    },
    logger: logger || { info() {}, warn() {} },
    metrics,
    monotonicClock: (() => {
      let now = 0;
      return () => (now += 5);
    })(),
  });
  return { calls, service };
}

test("empty query uses default limit and exactly one canonical source page", async () => {
  const { calls, service } = makeService();
  const result = await service.listSlaAlerts();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { cursor: null, limit: DEFAULT_LIMIT, stage: null, unitId: null });
  assert.deepEqual(result.items, []);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, null);
  assert.deepEqual(result.summary.pageCounts, {
    completed: 0,
    normal: 0,
    notConfigured: 0,
    overdue: 0,
    unavailable: 0,
    warning: 0,
  });
});

test("classification is ordered by page-local criticality and default omits normal/completed", async () => {
  const page = {
    items: [
      sourceItem("normal", "ON_TRACK"),
      sourceItem("warning-later", "DUE_SOON", { remainingMs: 400 }),
      sourceItem("overdue-low", "OVERDUE", { overdueMs: 200 }),
      sourceItem("not-configured", "NOT_CONFIGURED", {
        entryAt: "2026-07-18T08:00:00.000Z",
        historyCoverage: "PARTIAL",
      }),
      sourceItem("unavailable", "UNAVAILABLE"),
      sourceItem("warning-first", "DUE_SOON", { remainingMs: 100 }),
      sourceItem("overdue-high", "OVERDUE", { overdueMs: 900 }),
      sourceItem("completed", "COMPLETED"),
    ],
    pageInfo: { hasNextPage: false, nextCursor: null },
  };
  const { service } = makeService({ pages: [page] });
  const result = await service.listSlaAlerts();
  assert.deepEqual(
    result.items.map((item) => item.leadId),
    [
      "overdue-high",
      "overdue-low",
      "warning-first",
      "warning-later",
      "unavailable",
      "not-configured",
    ],
  );
  assert.equal(
    result.items.find((item) => item.leadId === "not-configured").historyCoverage,
    "PARTIAL",
  );
  assert.deepEqual(result.summary.pageCounts, {
    completed: 0,
    normal: 0,
    notConfigured: 1,
    overdue: 2,
    unavailable: 1,
    warning: 2,
  });
});

test("filters are validated, forwarded safely and status filtering happens after the source query", async () => {
  const page = {
    items: [sourceItem("warning", "DUE_SOON"), sourceItem("normal", "ON_TRACK")],
    pageInfo: { hasNextPage: false, nextCursor: null },
  };
  const { calls, service } = makeService({ pages: [page] });
  const result = await service.listSlaAlerts({
    limit: String(MAX_LIMIT),
    slaStatus: "WARNING",
    stage: "NEW",
    unitId: "unit-1",
  });
  assert.deepEqual(calls[0], {
    cursor: null,
    limit: MAX_LIMIT,
    stage: "NEW",
    unitId: "unit-1",
  });
  assert.deepEqual(
    result.items.map((item) => item.leadId),
    ["warning"],
  );
  assert.deepEqual(result.appliedFilters, {
    limit: MAX_LIMIT,
    slaStatus: "WARNING",
    stage: "NEW",
    unitId: "unit-1",
  });
  for (const invalid of [
    { limit: MAX_LIMIT + 1 },
    { limit: "" },
    { stage: ["NEW"] },
    { slaStatus: "DUE_SOON" },
    { unitId: {} },
    { responsibleId: "operator-1" },
  ]) {
    await assert.rejects(service.listSlaAlerts(invalid), { code: "CRM_INPUT_INVALID" });
  }
});

test("alert cursor wraps the source cursor, binds filters and supports an empty filtered page", async () => {
  const sourceCursor = encodeLeadCursor({
    createdAt: "2026-07-18T10:00:00.000Z",
    id: "lead-next",
  });
  const pages = [
    {
      items: [sourceItem("normal", "ON_TRACK")],
      pageInfo: { hasNextPage: true, nextCursor: sourceCursor },
    },
    {
      items: [sourceItem("warning", "DUE_SOON")],
      pageInfo: { hasNextPage: false, nextCursor: null },
    },
  ];
  const { calls, service } = makeService({ pages });
  const first = await service.listSlaAlerts({ stage: "NEW", unitId: "unit-1" });
  assert.deepEqual(first.items, []);
  assert.equal(first.hasMore, true);
  assert.equal(typeof first.nextCursor, "string");
  assert.deepEqual(
    decodeAlertCursor(first.nextCursor, normalizeFilters({ stage: "NEW", unitId: "unit-1" })),
    { sourceCursor },
  );
  const second = await service.listSlaAlerts({
    cursor: first.nextCursor,
    stage: "NEW",
    unitId: "unit-1",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cursor, sourceCursor);
  assert.deepEqual(
    second.items.map((item) => item.leadId),
    ["warning"],
  );
  assert.equal(second.hasMore, false);
  await assert.rejects(
    service.listSlaAlerts({ cursor: first.nextCursor, stage: "CONTACTED", unitId: "unit-1" }),
    { code: "CRM_CURSOR_INVALID", statusCode: 400 },
  );
  assert.equal(calls.length, 2);
});

test("invalid or oversized cursors are rejected before querying the source", async () => {
  const { calls, service } = makeService();
  await assert.rejects(service.listSlaAlerts({ cursor: "invalid" }), {
    code: "CRM_CURSOR_INVALID",
  });
  await assert.rejects(service.listSlaAlerts({ cursor: "a".repeat(1025) }), {
    code: "CRM_CURSOR_INVALID",
  });
  assert.equal(calls.length, 0);
});

test("read model is allowlisted and never leaks source PII or internal payloads", async () => {
  const { service } = makeService({
    pages: [
      {
        items: [sourceItem("lead-safe", "NOT_CONFIGURED")],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
    ],
  });
  const serialized = JSON.stringify(await service.listSlaAlerts());
  for (const forbidden of [
    "person@example.com",
    "52998224725",
    "sensitive reason",
    "assignedTo",
    "operator-1",
    "metadata",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("query failures are sanitized and success/failure observability remains fail-open", async () => {
  const logs = [];
  const metrics = new CrmLeadSlaAlertMetrics();
  const failing = new CrmLeadSlaAlertQueryService({
    leadQueryService: {
      async listLeads() {
        throw new Error("SELECT CPF 52998224725 FROM secret_host");
      },
    },
    logger: {
      warn(event, fields) {
        logs.push({ event, fields });
        throw new Error("logger offline");
      },
    },
    metrics,
    monotonicClock: (() => {
      let now = 10;
      return () => (now += 5);
    })(),
  });
  await assert.rejects(
    failing.listSlaAlerts({}, { correlationId: "corr-1", userId: "admin-1" }),
    (error) =>
      error.code === "CRM_SLA_ALERT_QUERY_FAILED" &&
      error.statusCode === 500 &&
      !error.message.includes("52998224725"),
  );
  assert.equal(JSON.stringify(logs).includes("52998224725"), false);
  assert.deepEqual(Object.keys(logs[0].fields).sort(), [
    "correlationId",
    "durationMs",
    "errorCode",
    "event",
    "filtersAppliedCount",
    "itemCount",
    "result",
    "source",
    "userId",
  ]);
  assert.equal(JSON.stringify(metrics.snapshot()).includes("admin-1"), false);
});

test("successful observability has non-negative duration and no Lead identifiers", async () => {
  const logs = [];
  const { service } = makeService({
    logger: {
      info(event, fields) {
        logs.push({ event, fields });
      },
    },
    pages: [
      {
        items: [sourceItem("lead-observed", "NOT_CONFIGURED")],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
    ],
  });
  await service.listSlaAlerts({}, { correlationId: "corr-1", userId: "admin-1" });
  assert.equal(logs[0].event, "CRM_SLA_ALERT_QUERY_SUCCEEDED");
  assert.equal(logs[0].fields.durationMs >= 0, true);
  assert.equal(logs[0].fields.itemCount, 1);
  assert.equal(JSON.stringify(logs).includes("lead-observed"), false);
});
