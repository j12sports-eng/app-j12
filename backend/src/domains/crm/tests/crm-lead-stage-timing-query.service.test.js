const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadStageTimingQueryService,
} = require("../application/crm-lead-stage-timing-query.service.js");

function service(overrides = {}) {
  return new CrmLeadStageTimingQueryService({
    clock: { now: () => new Date("2026-07-18T12:00:00Z") },
    logger: { info() {}, warn() {} },
    repository: {
      async findLeadForStageTiming() {
        return { id: "lead-1", unit_id: "unit-1", stage: "NEW", status: "OPEN" };
      },
      async findStageHistoryByLeadId() {
        return {
          items: [
            {
              action: "CREATED",
              actor_id: "operator-1",
              created_at: "2026-07-18 10:00:00",
              id: "history-1",
              new_stage: "NEW",
              new_status: "OPEN",
              previous_stage: null,
              previous_status: null,
              reason: "sensitive reason",
              contact_email: "person@example.com",
            },
          ],
          truncated: false,
        };
      },
    },
    ...overrides,
  });
}

test("service returns complete read-only detail without PII or reason", async () => {
  const result = await service().getLeadStageTiming({ leadId: "lead-1" });
  assert.equal(result.currentStageElapsedMs, 7_200_000);
  assert.equal(result.historyCoverage, "COMPLETE");
  assert.equal(result.sla.status, "NOT_CONFIGURED");
  assert.equal(result.timeline[0].actorId, "operator-1");
  assert.equal(JSON.stringify(result).includes("sensitive reason"), false);
  assert.equal(JSON.stringify(result).includes("person@example.com"), false);
});

test("partial history remains useful and unavailable history is explicit", async () => {
  const partial = service({
    repository: {
      async findLeadForStageTiming() {
        return { id: "lead-1", unit_id: "unit-1", stage: "CONTACTED", status: "OPEN" };
      },
      async findStageHistoryByLeadId() {
        return {
          items: [
            {
              action: "STAGE_CHANGED",
              actor_id: "op",
              created_at: "2026-07-18T11:00:00Z",
              id: "h2",
              new_stage: "CONTACTED",
              new_status: "OPEN",
              previous_stage: "NEW",
              previous_status: "OPEN",
            },
          ],
          truncated: false,
        };
      },
    },
  });
  assert.equal((await partial.getLeadStageTiming({ leadId: "lead-1" })).historyCoverage, "PARTIAL");

  const unavailable = service({
    repository: {
      async findLeadForStageTiming() {
        return { id: "lead-1", unit_id: "unit-1", stage: "NEW", status: "OPEN" };
      },
      async findStageHistoryByLeadId() {
        return { items: [], truncated: false };
      },
    },
  });
  const result = await unavailable.getLeadStageTiming({ leadId: "lead-1" });
  assert.equal(result.historyCoverage, "UNAVAILABLE");
  assert.equal(result.sla.status, "UNAVAILABLE");
});

test("missing lead is 404 and invalid id is 400", async () => {
  const missing = service({
    repository: {
      async findLeadForStageTiming() {
        return null;
      },
      async findStageHistoryByLeadId() {
        throw new Error("must not run");
      },
    },
  });
  await assert.rejects(missing.getLeadStageTiming({ leadId: "missing" }), {
    code: "CRM_LEAD_NOT_FOUND",
    statusCode: 404,
  });
  await assert.rejects(missing.getLeadStageTiming({ leadId: "DROP TABLE" }), {
    code: "CRM_INPUT_INVALID",
    statusCode: 400,
  });
});

test("repository failure is sanitized and observed without SQL or PII", async () => {
  const logs = [];
  const failing = service({
    logger: {
      warn(_event, fields) {
        logs.push(fields);
      },
    },
    repository: {
      async findLeadForStageTiming() {
        throw new Error("SQL CPF 52998224725");
      },
      async findStageHistoryByLeadId() {},
    },
  });
  await assert.rejects(
    failing.getLeadStageTiming({ leadId: "lead-1" }),
    (error) => error.code === "CRM_STAGE_TIMING_FAILED" && !error.message.includes("52998224725"),
  );
  assert.equal(JSON.stringify(logs).includes("52998224725"), false);
});
