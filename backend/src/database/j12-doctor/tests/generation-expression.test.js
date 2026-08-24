"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assessManifest } = require("../checks/schema-manifest-check");
const { PHYSICAL_STATES } = require("../constants");
const { draftChainManifests } = require("../manifests/draft-chain.manifests");

const MIGRATION_ID = "20260803123000_reconcile_enrollment_multiunit_invariants";

test("Doctor aceita as quatro generation expressions reais serializadas pelo MySQL 5.7", () => {
  const result = assessManifest(mysql57MultiunitSchema(), multiunitManifest());

  assert.equal(result.physicalState, PHYSICAL_STATES.PRESENT);
  assert.equal(result.structuralDrift, false);
  assert.equal(generationExpressionMismatches(result).length, 0);
});

test("Doctor mantém generationExpression mismatch para diferença semântica real", () => {
  const schema = mysql57MultiunitSchema();
  schema.tables.enrollments.columns.current_enrollment_student_profile_id.generationExpression =
    "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `student_person_id` else NULL end)";

  const result = assessManifest(schema, multiunitManifest());
  const mismatches = generationExpressionMismatches(result);

  assert.equal(result.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].details.column, "current_enrollment_student_profile_id");
  assert.deepEqual(mismatches[0].details.mismatches, ["generationExpression"]);
});

function generationExpressionMismatches(result) {
  return result.findings.filter(
    (finding) =>
      finding.code === "COLUMN_MISMATCH" &&
      finding.details.mismatches.includes("generationExpression"),
  );
}

function multiunitManifest() {
  const manifest = draftChainManifests.find((entry) => entry.migrationId === MIGRATION_ID);
  assert.ok(manifest, `Manifest ausente para ${MIGRATION_ID}.`);
  return manifest;
}

function mysql57MultiunitSchema() {
  const generated = (columnType, generationExpression) => ({
    columnType,
    nullable: true,
    generated: true,
    generationExpression,
  });
  const indexColumns = (names) => names.map((name) => ({ name }));

  return {
    database: "j12",
    counts: {},
    tables: {
      enrollments: {
        name: "enrollments",
        columns: {
          active_draft_unit_id: generated(
            "bigint(20)",
            "(case when ((`status` = 'DRAFT') and isnull(`deleted_at`)) then `unit_id` else NULL end)",
          ),
          current_enrollment_unit_id: generated(
            "bigint(20)",
            "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `unit_id` else NULL end)",
          ),
          current_enrollment_student_person_id: generated(
            "varchar(64)",
            "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `student_person_id` else NULL end)",
          ),
          current_enrollment_student_profile_id: generated(
            "varchar(64)",
            "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `student_profile_id` else NULL end)",
          ),
        },
        indexes: {
          ux_enrollments_active_draft_student_profile: {
            unique: true,
            columns: indexColumns([
              "active_draft_unit_id",
              "active_draft_student_person_id",
              "active_draft_student_profile_id",
            ]),
          },
          ux_enrollments_current_unit_student_profile: {
            unique: true,
            columns: indexColumns([
              "current_enrollment_unit_id",
              "current_enrollment_student_person_id",
              "current_enrollment_student_profile_id",
            ]),
          },
        },
        foreignKeys: {},
      },
    },
  };
}

