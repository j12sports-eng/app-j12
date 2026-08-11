"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assessManifest, normalizeColumnType } = require("../checks/schema-manifest-check");
const { PHYSICAL_STATES } = require("../constants");
const { inspectSchema } = require("../schema-inspector");

function fakeReader(results) {
  let call = 0;
  return {
    async query() {
      const value = results[call];
      call += 1;
      return [value, []];
    },
  };
}

test("normaliza somente largura de exibição inteira do MySQL", () => {
  assert.equal(normalizeColumnType("BIGINT"), "bigint");
  assert.equal(normalizeColumnType("bigint(20)"), "bigint");
  assert.equal(normalizeColumnType("BIGINT UNSIGNED"), "bigint unsigned");
  assert.notEqual(normalizeColumnType("BIGINT UNSIGNED"), normalizeColumnType("BIGINT"));
  assert.notEqual(normalizeColumnType("INT(11)"), normalizeColumnType("BIGINT"));
});

test("normaliza tabelas, colunas, índices e FKs do INFORMATION_SCHEMA", async () => {
  const reader = fakeReader([
    [{ TABLE_NAME: "enrollments", ENGINE: "InnoDB", TABLE_COLLATION: "utf8mb4_unicode_ci" }],
    [
      {
        TABLE_NAME: "enrollments",
        COLUMN_NAME: "id",
        ORDINAL_POSITION: 1,
        COLUMN_DEFAULT: null,
        IS_NULLABLE: "NO",
        DATA_TYPE: "varchar",
        COLUMN_TYPE: "varchar(64)",
        COLUMN_KEY: "PRI",
        EXTRA: "",
        GENERATION_EXPRESSION: "",
        CHARACTER_SET_NAME: "utf8mb4",
        COLLATION_NAME: "utf8mb4_unicode_ci",
      },
    ],
    [
      {
        TABLE_NAME: "enrollments",
        INDEX_NAME: "PRIMARY",
        NON_UNIQUE: 0,
        SEQ_IN_INDEX: 1,
        COLUMN_NAME: "id",
        COLLATION: "A",
        SUB_PART: null,
        INDEX_TYPE: "BTREE",
        EXPRESSION: null,
      },
    ],
    [
      {
        TABLE_NAME: "enrollments",
        CONSTRAINT_NAME: "fk_student",
        COLUMN_NAME: "id",
        ORDINAL_POSITION: 1,
        REFERENCED_TABLE_NAME: "people",
        REFERENCED_COLUMN_NAME: "id",
        UPDATE_RULE: "RESTRICT",
        DELETE_RULE: "RESTRICT",
      },
    ],
  ]);
  const snapshot = await inspectSchema(reader, "j12");
  assert.equal(snapshot.tables.enrollments.engine, "InnoDB");
  assert.equal(snapshot.tables.enrollments.charset, "utf8mb4");
  assert.equal(snapshot.tables.enrollments.columns.id.primary, true);
  assert.deepEqual(
    snapshot.tables.enrollments.indexes.PRIMARY.columns.map((item) => item.name),
    ["id"],
  );
  assert.equal(snapshot.tables.enrollments.foreignKeys.fk_student.referencedTable, "people");
});

test("classifica manifest como presente, parcial e incompatível", () => {
  const manifest = {
    id: "m1",
    tables: [
      {
        name: "sample",
        columns: {
          id: { columnType: "varchar(64)", nullable: false },
          generated_key: { columnType: "varchar(64)", nullable: true, generated: true },
        },
        indexes: { PRIMARY: { columns: ["id"], unique: true } },
        foreignKeys: {},
      },
    ],
  };
  const base = {
    database: "j12",
    counts: {},
    tables: {
      sample: {
        name: "sample",
        engine: "InnoDB",
        charset: "utf8mb4",
        columns: {
          id: { columnType: "varchar(64)", nullable: false },
          generated_key: { columnType: "varchar(64)", nullable: true, generated: true },
        },
        indexes: { PRIMARY: { columns: [{ name: "id" }], unique: true } },
        foreignKeys: {},
      },
    },
  };
  assert.equal(assessManifest(base, manifest).physicalState, PHYSICAL_STATES.PRESENT);
  const partial = structuredClone(base);
  delete partial.tables.sample.columns.generated_key;
  assert.equal(assessManifest(partial, manifest).physicalState, PHYSICAL_STATES.PARTIAL);
  const incompatible = structuredClone(base);
  incompatible.tables.sample.columns.id.nullable = true;
  assert.equal(assessManifest(incompatible, manifest).physicalState, PHYSICAL_STATES.INCOMPATIBLE);
});
