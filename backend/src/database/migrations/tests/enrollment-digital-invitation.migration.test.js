const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_INVITATION_COLUMN,
  ACTIVE_INVITATION_UNIQUE_INDEX,
  CREATE_TABLE_SQL,
  REQUIRED_COLUMNS,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_INDEXES,
  TABLE_NAME,
} = require("../20260720120000_create_enrollment_digital_invitations_table.js");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

test("enrollment digital invitation migration defines the expected schema", () => {
  for (const column of Object.keys(REQUIRED_COLUMNS)) {
    assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${column}\\b`));
  }

  for (const indexName of Object.keys(REQUIRED_INDEXES)) {
    assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${indexName}\\b`));
  }

  for (const [constraintName, [columnName, tableName]] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
    assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${constraintName}\\b`));
    assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${columnName}\\b`));
    assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${tableName}\\b`));
  }

  assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${ACTIVE_INVITATION_UNIQUE_INDEX}\\b`));
  assert.match(CREATE_TABLE_SQL, new RegExp(`\\b${ACTIVE_INVITATION_COLUMN}\\b`));
  assert.match(CREATE_TABLE_SQL, /GENERATED ALWAYS AS/i);
  assert.match(CREATE_TABLE_SQL, /UNIQUE INDEX ux_edi_token_hash/i);
  assert.match(CREATE_TABLE_SQL, /ENGINE=InnoDB/i);
  assert.match(CREATE_TABLE_SQL, /COLLATE=utf8mb4_unicode_ci/i);
});

test("enrollment digital invitation migration has canonical dependency ordering", () => {
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260720120000_create_enrollment_digital_invitations_table"],
    [
      "20260629134546_create_enrollments_table",
      "20260629190607_add_active_draft_unique_constraint_to_enrollments",
    ],
  );
});

test("enrollment digital invitation migration rollback is fail-closed", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "..",
      "20260720120000_create_enrollment_digital_invitations_table.js",
    ),
    "utf8",
  );

  assert.match(source, /SELECT COUNT\(\*\) AS total FROM/);
  assert.match(source, /Refusing to drop/);
  assert.match(source, /DROP TABLE IF EXISTS/);
  assert.match(source, new RegExp(`\\b${TABLE_NAME}\\b`));
});
