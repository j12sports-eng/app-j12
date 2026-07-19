const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmLeadStageSlaPolicy } = require("../domain/crm-lead-stage-sla-policy.js");

test("production-safe default has no invented SLA values", () => {
  const policy = new CrmLeadStageSlaPolicy();
  const result = policy.evaluate({ stage: "NEW", elapsedMs: 10, historyCoverage: "COMPLETE" });
  assert.equal(result.status, "NOT_CONFIGURED");
  assert.equal(result.limitMs, null);
});

test("configured policy classifies on-track, due-soon and overdue", () => {
  const policy = new CrmLeadStageSlaPolicy({ limitsMs: { NEW: 1_000 }, dueSoonRatio: 0.8 });
  assert.equal(
    policy.evaluate({ stage: "NEW", elapsedMs: 799, historyCoverage: "COMPLETE" }).status,
    "ON_TRACK",
  );
  assert.equal(
    policy.evaluate({ stage: "NEW", elapsedMs: 800, historyCoverage: "COMPLETE" }).status,
    "DUE_SOON",
  );
  const overdue = policy.evaluate({ stage: "NEW", elapsedMs: 1_250, historyCoverage: "COMPLETE" });
  assert.equal(overdue.status, "OVERDUE");
  assert.equal(overdue.remainingMs, 0);
  assert.equal(overdue.overdueMs, 250);
  assert.equal(overdue.consumedPercentage, 100);
});

test("remaining and percentage are bounded without division by zero", () => {
  const policy = new CrmLeadStageSlaPolicy({ limitsMs: { CONTACTED: 2_000 } });
  const result = policy.evaluate({
    stage: "CONTACTED",
    elapsedMs: 500,
    historyCoverage: "PARTIAL",
  });
  assert.equal(result.remainingMs, 1_500);
  assert.equal(result.overdueMs, 0);
  assert.equal(result.consumedPercentage, 25);
  assert.throws(() => new CrmLeadStageSlaPolicy({ limitsMs: { NEW: 0 } }), {
    code: "CRM_SLA_CONFIGURATION_INVALID",
  });
});

test("terminal stages complete and unavailable/unknown data do not expire", () => {
  const policy = new CrmLeadStageSlaPolicy({ limitsMs: { NEW: 1_000 } });
  assert.equal(
    policy.evaluate({ stage: "WON", elapsedMs: 999_999, historyCoverage: "COMPLETE" }).status,
    "COMPLETED",
  );
  assert.equal(
    policy.evaluate({ stage: "LOST", elapsedMs: null, historyCoverage: "UNAVAILABLE" }).status,
    "COMPLETED",
  );
  assert.equal(
    policy.evaluate({ stage: "NEW", elapsedMs: null, historyCoverage: "UNAVAILABLE" }).status,
    "UNAVAILABLE",
  );
  assert.equal(
    policy.evaluate({ stage: "UNKNOWN", elapsedMs: 1, historyCoverage: "COMPLETE" }).status,
    "UNAVAILABLE",
  );
});
