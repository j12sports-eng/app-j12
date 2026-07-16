const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PREREQUISITES,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_INDEXES,
  buildCreateTableSql,
  down,
} = require("../20260715143000_create_enrollment_financial_bridges_table.js");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

test("bridge migration defines required columns, uniques and foreign keys", () => {
  const sql = buildCreateTableSql();

  for (const column of [
    "obligation_id",
    "charge_id",
    "installment_id",
    "legacy_student_id",
    "enrollment_id",
    "created_at",
    "updated_at",
    "status",
    "created_by",
  ])
    assert.match(sql, new RegExp(`\\b${column}\\b`));

  assert.match(sql, /PRIMARY KEY \(obligation_id\)/);
  assert.match(sql, /UNIQUE INDEX ux_efb_charge \(charge_id\)/);
  assert.match(sql, /UNIQUE INDEX ux_efb_installment \(installment_id\)/);
  assert.equal(Object.keys(REQUIRED_INDEXES).length, 6);
  assert.equal(Object.keys(REQUIRED_FOREIGN_KEYS).length, 5);
  assert.equal(Object.keys(PREREQUISITES).length, 5);
});

test("bridge migration is dependency-first after financial obligations", () => {
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260715143000_create_enrollment_financial_bridges_table"],
    ["20260702120000_create_enrollment_financial_obligations_table"],
  );
});

test("bridge migration rollback is fail-closed for populated table", () => {
  assert.match(down.toString(), /SELECT COUNT\(\*\) AS total/);
  assert.match(down.toString(), /Refusing to drop/);
});
