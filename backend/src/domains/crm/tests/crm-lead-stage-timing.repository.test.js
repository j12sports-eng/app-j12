const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MySqlCrmLeadStageTimingRepository,
} = require("../infrastructure/mysql-crm-lead-stage-timing.repository.js");

test("repository uses two bounded parameterized projections without PII", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadStageTimingRepository({
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      if (calls.length === 1) return [[{ id: "lead-1", unit_id: "unit-1" }]];
      return [[{ id: "history-1" }]];
    },
  });
  assert.equal(
    (await repository.findLeadForStageTiming({ leadId: "lead-1", unitId: "unit-1" })).id,
    "lead-1",
  );
  const history = await repository.findStageHistoryByLeadId({
    leadId: "lead-1",
    unitId: "unit-1",
    limit: 50,
  });
  assert.equal(history.items.length, 1);
  assert.deepEqual(calls[0].params, ["lead-1", "unit-1"]);
  assert.deepEqual(calls[1].params, ["lead-1", "unit-1", 51]);
  assert.match(calls[1].sql, /ORDER BY created_at DESC,id DESC LIMIT \?/);
  for (const forbidden of ["contact_name", "contact_email", "contact_phone", "reason", "SELECT *"])
    assert.equal(
      calls
        .map((call) => call.sql)
        .join(" ")
        .includes(forbidden),
      false,
    );
});

test("history has a rigid maximum and explicit truncation", async () => {
  const repository = new MySqlCrmLeadStageTimingRepository({
    queryRunner: async () => [Array.from({ length: 501 }, (_, index) => ({ id: `h-${index}` }))],
  });
  const result = await repository.findStageHistoryByLeadId({
    leadId: "lead-1",
    unitId: "unit-1",
    limit: 9999,
  });
  assert.equal(result.items.length, 500);
  assert.equal(result.truncated, true);
});

test("repository propagates infrastructure failure", async () => {
  const repository = new MySqlCrmLeadStageTimingRepository({
    queryRunner: async () => {
      throw new Error("database unavailable");
    },
  });
  await assert.rejects(
    repository.findLeadForStageTiming({ leadId: "lead-1" }),
    /database unavailable/,
  );
});
