"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { assessManifest } = require("../../j12-doctor/checks/schema-manifest-check");
const { draftChainManifests } = require("../../j12-doctor/manifests/draft-chain.manifests");

const REQUIRED_MANIFESTS = Object.freeze([
  "20260712184500_create_auth_runtime_tables",
  "20260717220000_add_people_normalized_identity_columns",
  "20260719200000_add_pre_enrollment_integrity_constraints",
  "20260724120000_create_auth_identities_table",
  "20260724123000_create_user_unit_memberships_table",
  "20260729120000_add_enrollment_unit_ownership_to_enrollments",
  "20260729150000_add_enrollment_unit_foreign_key",
  "20260803120000_prepare_enrollment_draft_ownership",
  "20260729180000_enforce_enrollment_multiunit_invariants",
  "20260803123000_reconcile_enrollment_multiunit_invariants",
  "20260803133000_reconcile_auth_runtime_charset_collation",
]);

test("manifests completos cobrem toda a cadeia mínima de DRAFT", () => {
  const byId = new Map(draftChainManifests.map((manifest) => [manifest.migrationId, manifest]));
  for (const id of REQUIRED_MANIFESTS) {
    const manifest = byId.get(id);
    assert.ok(manifest, id);
    assert.ok(manifest.requiredTables.length > 0, id);
    const structuralArtifacts =
      manifest.requiredColumns.length +
      manifest.requiredIndexes.length +
      manifest.requiredForeignKeys.length;
    const completeTableOptions = manifest.tables.every(
      (table) => table.engine && table.charset && table.collation,
    );
    assert.ok(structuralArtifacts > 0 || completeTableOptions, id);
    for (const column of manifest.requiredColumns) {
      assert.equal(typeof column.nullable, "boolean", `${id}:${column.name}`);
      assert.ok(column.columnType, `${id}:${column.name}`);
    }
  }
});

test("generated columns e índices exigem composição exata", () => {
  const manifest = byId("20260803123000_reconcile_enrollment_multiunit_invariants");
  const schema = materialize(manifest);
  assert.equal(assessManifest(schema, manifest).physicalState, PHYSICAL_STATES.PRESENT);

  schema.tables.enrollments.columns.active_draft_unit_id.generationExpression =
    "CASE WHEN status = 'ACTIVE' THEN unit_id ELSE NULL END";
  const expressionMismatch = assessManifest(schema, manifest);
  assert.equal(expressionMismatch.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.ok(
    expressionMismatch.findings.some(
      (finding) =>
        finding.code === "COLUMN_MISMATCH" &&
        finding.details.mismatches.includes("generationExpression"),
    ),
  );

  const schemaWithIndexDrift = materialize(manifest);
  schemaWithIndexDrift.tables.enrollments.indexes.ux_enrollments_current_unit_student_profile.columns.reverse();
  assert.ok(
    assessManifest(schemaWithIndexDrift, manifest).findings.some(
      (finding) => finding.code === "INDEX_MISMATCH",
    ),
  );
});

test("unit_id canônico é signed BIGINT e API mantém serialização decimal string", () => {
  for (const [id, table] of [
    ["20260724123000_create_user_unit_memberships_table", "user_unit_memberships"],
    ["20260729120000_add_enrollment_unit_ownership_to_enrollments", "enrollments"],
    [
      "20260803130000_reconcile_enrollment_digital_invitation_unit_type",
      "enrollment_digital_invitations",
    ],
  ]) {
    const manifest = byId(id);
    const unitId = manifest.requiredColumns.find(
      (column) => column.table === table && column.name === "unit_id",
    );
    assert.equal(unitId.columnType, "bigint", id);
    assert.doesNotMatch(unitId.columnType, /unsigned/iu);
  }

  const enrollmentRepository = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "../../../domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js",
    ),
    "utf8",
  );
  const membershipRepository = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "../../../domains/auth/infrastructure/repositories/mysql-user-unit-membership.repository.js",
    ),
    "utf8",
  );
  assert.match(enrollmentRepository, /String\(row\.unit_id\)/u);
  assert.match(membershipRepository, /String\(row\.unit_id\)/u);
});

test("política corretiva declara DDL implícito como fluxo sem rollback automático", () => {
  const reconcile = byId("20260803123000_reconcile_enrollment_multiunit_invariants");
  assert.equal(reconcile.applyPolicy.reconciliation, true);
  assert.ok(reconcile.applyPolicy.allowedPhysicalStates.includes("DRIFT_DETECTED"));
  assert.ok(reconcile.applyPolicy.allowedPhysicalStates.includes("PARTIALLY_PRESENT"));
  assert.ok(
    reconcile.applyPolicy.plannedActions.some(
      (action) => action.action === "REPLACE_LEGACY_IF_EXACT",
    ),
  );
});

function byId(id) {
  const manifest = draftChainManifests.find((entry) => entry.migrationId === id);
  assert.ok(manifest, id);
  return manifest;
}

function materialize(manifest) {
  const tables = {};
  for (const expected of manifest.tables) {
    tables[expected.name] = {
      engine: expected.engine || "InnoDB",
      charset: expected.charset || "utf8mb4",
      collation: expected.collation || null,
      columns: Object.fromEntries(
        Object.entries(expected.columns || {}).map(([name, column]) => [
          name,
          {
            columnType: column.columnType,
            nullable: column.nullable,
            generated: Boolean(column.generated),
            generationExpression: column.generationExpression || null,
            autoIncrement: Boolean(column.autoIncrement),
            default: Object.prototype.hasOwnProperty.call(column, "default")
              ? column.default
              : null,
          },
        ]),
      ),
      indexes: Object.fromEntries(
        Object.entries(expected.indexes || {}).map(([name, index]) => [
          name,
          {
            unique: index.unique,
            columns: index.columns.map((columnName) => ({ name: columnName })),
          },
        ]),
      ),
      foreignKeys: Object.fromEntries(
        Object.entries(expected.foreignKeys || {}).map(([name, foreignKey]) => [
          name,
          {
            columns: foreignKey.columns,
            referencedTable: foreignKey.referencedTable,
            referencedColumns: foreignKey.referencedColumns,
          },
        ]),
      ),
    };
  }
  return { tables };
}
