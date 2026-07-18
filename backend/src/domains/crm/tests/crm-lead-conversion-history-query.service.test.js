const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadConversionHistoryQueryService,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  encodeCursor,
} = require("../application/crm-lead-conversion-history-query.service.js");

function record(overrides = {}) {
  return {
    conversionStatus: "COMPLETED",
    convertedAt: "2026-07-18T20:00:00.000Z",
    convertedBy: "admin-1",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    id: "conversion-1",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    unitId: "unit-1",
    ...overrides,
  };
}

function service(repository = {}) {
  return new CrmLeadConversionHistoryQueryService({
    repository: {
      async findConversionHistoryById() {
        return null;
      },
      async listConversionHistory() {
        return [];
      },
      ...repository,
    },
  });
}

test("history list is empty and applies the default bounded limit", async () => {
  let received;
  const result = await service({
    async listConversionHistory(filters) {
      received = filters;
      return [];
    },
  }).listConversions();

  assert.deepEqual(result, {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  assert.equal(received.limit, DEFAULT_LIMIT);
  assert.equal(received.fetchLimit, DEFAULT_LIMIT + 1);
});

test("history list returns only operational fields and explicit unavailable audit fields", async () => {
  const result = await service({
    async listConversionHistory() {
      return [
        record({
          cpf: "52998224725",
          contact_email: "pii@example.com",
          idempotencyKey: "secret",
          metadata_json: '{"name":"PII"}',
          sql: "SELECT secret",
          stack: "secret stack",
        }),
      ];
    },
  }).listConversions();

  assert.deepEqual(result.items[0].resolutions, {
    enrollment: null,
    person: null,
    profile: null,
  });
  assert.deepEqual(result.items[0].reused, {
    enrollment: null,
    person: null,
    profile: null,
  });
  assert.equal(result.items[0].correlationId, null);
  const serialized = JSON.stringify(result);
  for (const forbidden of ["52998224725", "pii@example.com", "secret", "SELECT", "stack"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("history pagination uses a valid opaque convertedAt plus id cursor", async () => {
  let received;
  const query = service({
    async listConversionHistory(filters) {
      received = filters;
      return [record({ id: "conversion-2", convertedAt: "2026-07-18T21:00:00.000Z" }), record()];
    },
  });
  const first = await query.listConversions({ limit: 1 });
  assert.equal(first.items.length, 1);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.equal(typeof first.pageInfo.nextCursor, "string");
  assert.equal(received.fetchLimit, 2);

  const cursor = encodeCursor({
    convertedAt: "2026-07-18T20:00:00.000Z",
    id: "conversion-1",
  });
  await query.listConversions({ cursor });
  assert.deepEqual(received.cursor, {
    convertedAt: "2026-07-18T20:00:00.000Z",
    id: "conversion-1",
  });
});

test("history rejects invalid cursor and limits outside the hard boundary", async () => {
  await assert.rejects(service().listConversions({ cursor: "invalid" }), {
    code: "CRM_CURSOR_INVALID",
    statusCode: 400,
  });
  await assert.rejects(service().listConversions({ limit: 0 }), {
    code: "CRM_INPUT_INVALID",
  });
  await assert.rejects(service().listConversions({ limit: MAX_LIMIT + 1 }), {
    code: "CRM_INPUT_INVALID",
  });
});

test("history validates and forwards every supported persisted filter", async () => {
  let received;
  await service({
    async listConversionHistory(filters) {
      received = filters;
      return [];
    },
  }).listConversions({
    convertedBy: "admin@example.com",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-18",
    enrollmentStatus: "DRAFT",
    leadId: "lead-1",
    unitId: "unit-1",
  });

  assert.equal(received.leadId, "lead-1");
  assert.equal(received.unitId, "unit-1");
  assert.equal(received.convertedBy, "admin@example.com");
  assert.equal(received.enrollmentStatus, "DRAFT");
  assert.equal(received.dateFrom, "2026-07-01T00:00:00.000Z");
  assert.equal(received.dateTo, "2026-07-18T23:59:59.999Z");

  await assert.rejects(
    service().listConversions({ dateFrom: "2026-07-19", dateTo: "2026-07-18" }),
    {
      code: "CRM_INPUT_INVALID",
    },
  );
  await assert.rejects(service().listConversions({ enrollmentStatus: "ACTIVE" }), {
    code: "CRM_INPUT_INVALID",
  });
});

test("history detail returns a persisted completed conversion and handles missing fields", async () => {
  const complete = await service({
    async findConversionHistoryById() {
      return record();
    },
  }).getConversionById("conversion-1");
  assert.equal(complete.id, "conversion-1");
  assert.equal(complete.source, "crm_lead_enrollment_conversions");
  assert.equal(complete.version, null);

  const partial = await service({
    async findConversionHistoryById() {
      return record({ convertedBy: null, personProfileId: null });
    },
  }).getConversionById("conversion-1");
  assert.equal(partial.convertedBy, null);
  assert.equal(partial.personProfileId, null);
});

test("history detail returns sanitized 404 and repository errors are sanitized", async () => {
  await assert.rejects(service().getConversionById("missing"), {
    code: "CRM_CONVERSION_HISTORY_NOT_FOUND",
    statusCode: 404,
  });

  const failing = service({
    async listConversionHistory() {
      throw new Error("SQL CPF 52998224725");
    },
    async findConversionHistoryById() {
      throw new Error("stack idempotencyKey secret");
    },
  });
  await assert.rejects(
    failing.listConversions(),
    (error) =>
      error.code === "CRM_CONVERSION_HISTORY_FAILED" &&
      error.statusCode === 500 &&
      !error.message.includes("52998224725"),
  );
  await assert.rejects(failing.getConversionById("conversion-1"), {
    code: "CRM_CONVERSION_HISTORY_FAILED",
    statusCode: 500,
  });
});
