const assert = require("node:assert/strict");
const test = require("node:test");

const { MIGRATION_DEPENDENCIES } = require("../../../database/migration-runner/migration-dependencies.js");
const migration = require("../../../database/migrations/20260724120000_create_auth_identities_table.js");

test("auth identities migration declares canonical table contract", () => {
  assert.equal(migration.TABLE_NAME, "auth_identities");
  assert.deepEqual(migration.AUTH_RUNTIME_TABLES, ["users", "j12_usuarios"]);
  assert.equal(migration.REQUIRED_COLUMNS.id, "varchar(64)");
  assert.equal(migration.REQUIRED_COLUMNS.source, "varchar(32)");
  assert.equal(migration.REQUIRED_COLUMNS.source_user_id, "varchar(64)");
  assert.equal(migration.REQUIRED_COLUMNS.status, "varchar(32)");
  assert.equal(
    migration.REQUIRED_INDEXES.ux_auth_identities_source_user,
    "source,source_user_id",
  );
});

test("auth identities migration avoids PII and polymorphic foreign keys", () => {
  const sql = migration.CREATE_TABLE_SQL.toLowerCase();

  assert.equal(sql.includes("email"), false);
  assert.equal(sql.includes("cpf"), false);
  assert.equal(sql.includes("telefone"), false);
  assert.equal(sql.includes("foreign key"), false);
  assert.equal(sql.includes("constraint"), false);
  assert.equal(sql.includes("generated always"), false);
  assert.equal(sql.includes("check ("), false);
});

test("auth identities migration is registered after auth runtime tables", () => {
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260724120000_create_auth_identities_table"],
    ["20260712184500_create_auth_runtime_tables"],
  );
});
