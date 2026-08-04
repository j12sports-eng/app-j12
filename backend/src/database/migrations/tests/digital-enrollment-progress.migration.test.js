const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

const migrationPath = path.resolve(
  __dirname,
  "../20260724150000_create_digital_enrollment_progress.js",
);

test("digital enrollment progress migration has safe topology", () => {
  const source = fs.readFileSync(migrationPath, "utf8");
  for (const table of [
    "enrollments",
    "people",
    "person_profiles",
    "person_relationships",
    "enrollment_digital_invitations",
  ]) {
    assert.match(source, new RegExp(table));
  }
  assert.match(source, /UNIQUE INDEX ux_dep_enrollment \(enrollment_id\)/);
  assert.match(source, /revision INT UNSIGNED NOT NULL DEFAULT 1/);
  assert.match(source, /responsible_relationship_id VARCHAR\(64\) NOT NULL/);
  assert.doesNotMatch(source, /j12_|cpf|email|telefone|phone|nome/i);
  assert.doesNotMatch(source, /ORDER BY|LIMIT 1/i);
  assert.match(source, /if \(!existing\.has\(column\)\)/);
});

test("digital enrollment progress migration has canonical dependency ordering", () => {
  assert.deepEqual(MIGRATION_DEPENDENCIES["20260724150000_create_digital_enrollment_progress"], [
    "20260803120000_prepare_enrollment_draft_ownership",
    "20260803130000_reconcile_enrollment_digital_invitation_unit_type",
  ]);
});
