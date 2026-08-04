"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { runDoctor } = require("../doctor");

test("runner monta relatório mínimo sem mutações usando somente reader fake", async () => {
  const results = [
    [{ TABLE_NAME: "sample", ENGINE: "InnoDB", TABLE_COLLATION: "utf8mb4_unicode_ci" }],
    [
      {
        TABLE_NAME: "sample",
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
        TABLE_NAME: "sample",
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
    [],
  ];
  let call = 0;
  const reader = {
    async query(sql) {
      assert.match(sql, /^SELECT/);
      const rows = results[call];
      call += 1;
      return [rows, []];
    },
  };
  const catalog = [
    {
      id: "20260101000000_sample",
      timestamp: "20260101000000",
      name: "sample",
      fileName: "20260101000000_sample.sql",
      checksum: "abc",
      dependencies: [],
    },
  ];
  const manifests = [
    {
      id: catalog[0].id,
      migrationId: catalog[0].id,
      tables: [
        {
          name: "sample",
          columns: { id: { columnType: "varchar(64)", nullable: false } },
          indexes: { PRIMARY: { columns: ["id"], unique: true } },
          foreignKeys: {},
        },
      ],
      requiredTables: ["sample"],
      requiredColumns: [],
      requiredIndexes: [],
      requiredForeignKeys: [],
      requiredGeneratedColumns: [],
      optionalArtifacts: [],
    },
  ];
  const report = await runDoctor({
    reader,
    databaseName: "j12",
    databaseHost: "db.internal",
    databaseRemote: true,
    catalogLoader: async () => catalog,
    manifests,
    now: () => new Date("2026-08-03T12:00:00.000Z"),
  });
  assert.deepEqual(report.database, { host: "db.internal", name: "j12", remote: true });
  assert.equal(report.summary.migrationsTotal, 1);
  assert.equal(report.summary.physicallyPresent, 1);
  assert.equal(report.schema.tables, 1);
  assert.ok(Array.isArray(report.criticalFindings));
  assert.equal(call, 4);
});
