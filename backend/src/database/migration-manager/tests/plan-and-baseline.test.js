"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildBaselinePlan } = require("../baseline-manager");
const { buildMigrationPlan } = require("../plan-manager");
const { canonicalPlan, doctorReport } = require("./fixtures");

test("plan separa presentes, ausentes, drift e prontas para baseline", () => {
  const report = doctorReport();
  const result = buildMigrationPlan({ doctorReport: report, canonicalPlan: canonicalPlan(report) });
  assert.deepEqual(result.summary, {
    total: 5,
    physicallyPresent: 2,
    physicallyAbsent: 1,
    structuralDrift: 1,
    formalDrift: 2,
    tableOptionDrift: 0,
    baselineReady: 2,
    baselineBlocked: 3,
    unknown: 1,
  });
  assert.deepEqual(
    result.baselineReady.map((item) => item.id),
    ["20260101000000_people", "20260102000000_enrollments"],
  );
});

test("baseline é sempre dry-run e não gera SQL", () => {
  const report = doctorReport();
  const result = buildBaselinePlan({ doctorReport: report, canonicalPlan: canonicalPlan(report) });
  assert.equal(result.dryRun, true);
  assert.equal(result.executable, false);
  assert.equal(result.writesPerformed, false);
  assert.equal(result.ledger.exists, false);
  assert.ok(result.executionBlockers.includes("LEDGER_CREATION_REQUIRES_EXPLICIT_AUTHORIZATION"));
  assert.equal(result.registrations.length, 2);
  assert.ok(result.registrations.every((item) => item.registrationMode === "BASELINE"));
  assert.equal(JSON.stringify(result).match(/INSERT|CREATE TABLE|ALTER TABLE/g), null);
});

test("baseline bloqueia candidata cuja dependência não está aplicada nem pronta", () => {
  const report = doctorReport();
  report.migrations[1].dependencies = ["20260104000000_unknown"];
  const result = buildBaselinePlan({ doctorReport: report, canonicalPlan: canonicalPlan(report) });
  const blocked = result.blocked.find((item) => item.id === "20260102000000_enrollments");
  assert.ok(blocked.reasons.includes("DEPENDENCY_NOT_SATISFIED"));
  assert.deepEqual(blocked.unresolvedDependencies, ["20260104000000_unknown"]);
});
