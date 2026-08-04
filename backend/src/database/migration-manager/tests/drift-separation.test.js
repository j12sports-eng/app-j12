"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { evaluateBaselineEligibility } = require("../baseline-eligibility-policy");

function baseMigration(physicalState) {
  return {
    id: "20260101000000_sample",
    ledgerState: LEDGER_STATES.PENDING,
    physicalState,
    checksumMatches: null,
    manifestAvailable: true,
  };
}

test("migration totalmente ausente não é classificada como structural drift", () => {
  const migration = baseMigration(PHYSICAL_STATES.ABSENT);
  const result = evaluateBaselineEligibility({
    migration,
    findings: [{ code: "TABLE_MISSING", details: { migrationId: migration.id } }],
  });
  assert.equal(result.structuralDrift, false);
  assert.ok(result.reasons.includes("REQUIRED_ARTIFACT_MISSING"));
  assert.ok(result.reasons.includes("PHYSICAL_STATE_NOT_PRESENT"));
});

test("divergência somente formal não é promovida a structural drift", () => {
  const migration = { ...baseMigration(PHYSICAL_STATES.PRESENT), driftDetected: true };
  const result = evaluateBaselineEligibility({ migration });
  assert.equal(result.formalDrift, true);
  assert.equal(result.structuralDrift, false);
  assert.equal(result.state, "BASELINE_READY");
});
