const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../20260810171000_reconcile_j12_unidades_id_bigint.js");

test("reconcile j12_unidades id reconhece legado e canonico", () => {
  assert.equal(
    migration.isAuditedLegacy({
      DATA_TYPE: "int",
      COLUMN_TYPE: "int(11)",
      IS_NULLABLE: "NO",
      EXTRA: "auto_increment",
    }),
    true,
  );

  assert.equal(
    migration.isCanonical({
      DATA_TYPE: "bigint",
      COLUMN_TYPE: "bigint",
      IS_NULLABLE: "NO",
      EXTRA: "auto_increment",
    }),
    true,
  );
});

test("reconcile j12_unidades id rejeita unsigned", () => {
  assert.equal(
    migration.isAuditedLegacy({
      DATA_TYPE: "int",
      COLUMN_TYPE: "int(11) unsigned",
      IS_NULLABLE: "NO",
      EXTRA: "auto_increment",
    }),
    false,
  );

  assert.equal(
    migration.isCanonical({
      DATA_TYPE: "bigint",
      COLUMN_TYPE: "bigint unsigned",
      IS_NULLABLE: "NO",
      EXTRA: "auto_increment",
    }),
    false,
  );
});

test("reconcile j12_unidades id rejeita definicoes inesperadas", () => {
  assert.equal(
    migration.isAuditedLegacy({
      DATA_TYPE: "varchar",
      COLUMN_TYPE: "varchar(64)",
      IS_NULLABLE: "NO",
      EXTRA: "",
    }),
    false,
  );

  assert.equal(
    migration.isCanonical({
      DATA_TYPE: "bigint",
      COLUMN_TYPE: "bigint",
      IS_NULLABLE: "YES",
      EXTRA: "auto_increment",
    }),
    false,
  );
});
