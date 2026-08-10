const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../20260724123000_create_user_unit_memberships_table.js");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

test("user-unit memberships migration declares canonical schema contract", () => {
  assert.equal(migration.TABLE_NAME, "user_unit_memberships");
  assert.deepEqual(migration.REQUIRED_PARENT_TABLES, ["auth_identities", "j12_unidades"]);

  for (const column of Object.keys(migration.REQUIRED_COLUMNS)) {
    assert.match(migration.CREATE_TABLE_SQL, new RegExp(`\\b${column}\\b`));
  }

  for (const [constraintName, [columnName, tableName]] of Object.entries(
    migration.REQUIRED_FOREIGN_KEYS,
  )) {
    assert.match(migration.CREATE_TABLE_SQL, new RegExp(`\\b${constraintName}\\b`));
    assert.match(migration.CREATE_TABLE_SQL, new RegExp(`\\b${columnName}\\b`));
    assert.match(migration.CREATE_TABLE_SQL, new RegExp(`\\b${tableName}\\b`));
  }

  for (const indexName of Object.keys(migration.REQUIRED_INDEXES)) {
    assert.match(migration.CREATE_TABLE_SQL, new RegExp(`\\b${indexName}\\b`));
  }

  assert.match(migration.CREATE_TABLE_SQL, /GENERATED ALWAYS AS/i);
  assert.match(migration.CREATE_TABLE_SQL, /UNIQUE INDEX ux_user_unit_memberships_active_default/i);
  assert.match(migration.CREATE_TABLE_SQL, /ENGINE=InnoDB/i);
  assert.match(migration.CREATE_TABLE_SQL, /COLLATE=utf8mb4_unicode_ci/i);
});

test("user-unit memberships migration follows canonical dependency ordering", () => {
  assert.deepEqual(MIGRATION_DEPENDENCIES["20260724123000_create_user_unit_memberships_table"], [
    "20260724120000_create_auth_identities_table",
    "20260810171000_reconcile_j12_unidades_id_bigint",
  ]);
});

test("user-unit memberships migration rollback is fail-closed", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "..",
      "20260724123000_create_user_unit_memberships_table.js",
    ),
    "utf8",
  );

  assert.match(source, /SELECT COUNT\(\*\) AS total FROM/);
  assert.match(source, /Refusing to drop/);
  assert.match(source, /DROP TABLE IF EXISTS/);
  assert.match(source, /Required table \$\{tableName\} does not exist\./);
});
