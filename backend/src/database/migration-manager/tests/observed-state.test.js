"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { buildMigrationPlan } = require("../plan-manager");
const { buildValidationReport } = require("../validate-manager");

const PEOPLE = "20260712183000_create_people_domain_tables";
const ENROLLMENTS = "20260629134546_create_enrollments_table";
const ACTIVE_DRAFT = "20260629190607_add_active_draft_unique_constraint_to_enrollments";
const CONFIRMATION = "20260629232350_add_enrollment_confirmation_audit_columns";
const MULTIUNIT = "20260729180000_enforce_enrollment_multiunit_invariants";

function item(id, physicalState, dependencies = [], manifestAvailable = true) {
  return {
    id,
    name: id.slice(15),
    fileName: `${id}.js`,
    checksum: "a".repeat(64),
    dependencies,
    ledgerState: LEDGER_STATES.PENDING,
    physicalState,
    checksumMatches: null,
    manifestAvailable,
    driftDetected: physicalState !== PHYSICAL_STATES.ABSENT,
  };
}

test("estado observado preserva 4 ready, 11 absent, 18 unknown e 1 structural drift", () => {
  const present = [
    item(PEOPLE, PHYSICAL_STATES.PRESENT),
    item(ENROLLMENTS, PHYSICAL_STATES.PRESENT, [PEOPLE]),
    item(ACTIVE_DRAFT, PHYSICAL_STATES.PRESENT, [ENROLLMENTS]),
    item(CONFIRMATION, PHYSICAL_STATES.PRESENT, [ENROLLMENTS]),
  ];
  const absent = Array.from({ length: 11 }, (_, index) =>
    item(
      `202608${String(index + 1).padStart(2, "0")}000000_absent_${index}`,
      PHYSICAL_STATES.ABSENT,
    ),
  );
  const duplicateOne = item(
    "20260701103000_add_enrollment_class_links_table",
    PHYSICAL_STATES.NOT_ASSESSED,
    [],
    false,
  );
  const duplicateTwo = item(
    "20260701120000_add_enrollment_class_links_table",
    PHYSICAL_STATES.NOT_ASSESSED,
    [duplicateOne.id],
    false,
  );
  const unknown = [
    duplicateOne,
    duplicateTwo,
    ...Array.from({ length: 16 }, (_, index) =>
      item(
        `202609${String(index + 1).padStart(2, "0")}000000_unknown_${index}`,
        PHYSICAL_STATES.NOT_ASSESSED,
        [],
        false,
      ),
    ),
  ];
  const multiunit = item(MULTIUNIT, PHYSICAL_STATES.INCOMPATIBLE, [ACTIVE_DRAFT]);
  const migrations = [...present, ...absent, ...unknown, multiunit];
  const findings = [
    { code: "COLUMN_MISSING", details: { migrationId: MULTIUNIT } },
    { code: "INDEX_MISSING", details: { migrationId: MULTIUNIT } },
    { code: "INDEX_MISMATCH", details: { migrationId: MULTIUNIT } },
  ];
  const doctorReport = {
    database: { host: "remote.example", name: "j12", remote: true },
    schemaSnapshot: { tables: {} },
    expectedSchema: [],
    migrations,
    findings,
    summary: {
      ledgerApplied: 0,
      ledgerPending: 34,
      physicallyPresent: 4,
      partiallyPresent: 0,
      physicallyAbsent: 11,
      unknown: 18,
    },
  };
  const canonicalPlan = migrations.map((migration) => ({
    id: migration.id,
    dependencies: migration.dependencies,
  }));
  const plan = buildMigrationPlan({ doctorReport, canonicalPlan });
  assert.deepEqual(plan.summary, {
    total: 34,
    physicallyPresent: 4,
    physicallyAbsent: 11,
    structuralDrift: 1,
    formalDrift: 4,
    tableOptionDrift: 0,
    baselineReady: 4,
    baselineBlocked: 30,
    unknown: 18,
  });
  assert.deepEqual(
    plan.baselineReady.map((entry) => entry.migrationId),
    [PEOPLE, ENROLLMENTS, ACTIVE_DRAFT, CONFIRMATION],
  );
  assert.ok(
    plan.baselineBlocked
      .find((entry) => entry.migrationId === MULTIUNIT)
      .reasons.includes("STRUCTURAL_DRIFT"),
  );

  const validation = buildValidationReport({ doctorReport, canonicalPlan });
  assert.equal(validation.summary.formalDriftCount, 4);
  assert.equal(validation.summary.structuralDriftCount, 1);
  assert.equal(validation.summary.baselineReadyCount, 4);
  assert.equal(validation.summary.baselineBlockedCount, 30);
  assert.equal(validation.summary.ambiguousOwnershipCount, 1);
});
