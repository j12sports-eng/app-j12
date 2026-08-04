"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { evaluateCatalogBaselineEligibility } = require("../baseline-eligibility-policy");

function migration(id, name, dependencies = []) {
  return {
    id,
    name,
    dependencies,
    ledgerState: LEDGER_STATES.PENDING,
    physicalState: PHYSICAL_STATES.PRESENT,
    checksumMatches: null,
    manifestAvailable: true,
  };
}

test("ownership ambíguo bloqueia somente as migrations duplicadas", () => {
  const first = migration("20260701103000_add_links", "add_links");
  const second = migration("20260701120000_add_links", "add_links", [first.id]);
  const unrelated = migration("20260712183000_create_people", "create_people");
  const migrations = [first, second, unrelated];
  const policy = evaluateCatalogBaselineEligibility({
    doctorReport: { migrations, findings: [], expectedSchema: [] },
    canonicalPlan: migrations.map((item) => ({ id: item.id })),
  });
  assert.deepEqual(
    policy.ready.map((item) => item.migrationId),
    [unrelated.id],
  );
  assert.ok(
    policy.blocked
      .filter((item) => [first.id, second.id].includes(item.migrationId))
      .every((item) => item.reasons.includes("AMBIGUOUS_MIGRATION_OWNERSHIP")),
  );
});
