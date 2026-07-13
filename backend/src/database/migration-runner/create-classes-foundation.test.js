const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REQUIRED_COLUMNS,
  REQUIRED_INDEXES,
  assertColumnType,
  buildCreateTableSql,
  down,
  runUp,
} = require("../migrations/20260713100000_create_classes_foundation_table.js");

test("classes foundation reproduces the audited legacy schema and indexes", () => {
  const sql = buildCreateTableSql();
  for (const column of Object.keys(REQUIRED_COLUMNS))
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"));
  for (const index of Object.keys(REQUIRED_INDEXES)) assert.match(sql, new RegExp(index));
  assert.match(sql, /ENGINE=InnoDB/);
});

test("classes foundation accepts legacy INT or BIGINT identifiers only", () => {
  assert.doesNotThrow(() =>
    assertColumnType({ COLUMN_NAME: "id", COLUMN_TYPE: "bigint" }, "integer"),
  );
  assert.doesNotThrow(() => assertColumnType({ COLUMN_NAME: "id", COLUMN_TYPE: "int" }, "integer"));
  assert.throws(
    () => assertColumnType({ COLUMN_NAME: "id", COLUMN_TYPE: "varchar(64)" }, "integer"),
    /Unexpected type/,
  );
});

test("classes foundation refuses destructive rollback", async () => {
  await assert.rejects(() => down(), /Refusing to drop j12_turmas/);
});

test("classes foundation creates a missing table with the canonical structure", async () => {
  const database = fakeDatabase({ indexes: canonicalIndexes() });
  const logs = [];
  await runUp({
    log: (message) => logs.push(message),
    queryFn: database.query,
    tableExistsFn: async () => false,
  });
  assert.ok(database.statements.some((sql) => /CREATE TABLE IF NOT EXISTS j12_turmas/.test(sql)));
  assert.deepEqual(logs, ["CREATED_TABLE=j12_turmas", "CLASSES_FOUNDATION_READY=true"]);
});

test("classes foundation adopts a compatible legacy table without reshaping it", async () => {
  const database = fakeDatabase({ indexes: canonicalIndexes() });
  await runUp({
    log: () => {},
    queryFn: database.query,
    tableExistsFn: async () => true,
  });
  assert.equal(
    database.statements.some((sql) => /^\s*(?:CREATE|ALTER)\s/i.test(sql)),
    false,
  );
});

test("classes foundation rejects incompatible legacy engine and column types", async () => {
  const wrongEngine = fakeDatabase({ engine: "MyISAM", indexes: canonicalIndexes() });
  await assert.rejects(
    () =>
      runUp({
        log: () => {},
        queryFn: wrongEngine.query,
        tableExistsFn: async () => true,
      }),
    /must use InnoDB/,
  );

  const wrongColumns = canonicalColumns();
  wrongColumns.find((column) => column.COLUMN_NAME === "id").COLUMN_TYPE = "varchar(64)";
  const wrongType = fakeDatabase({ columns: wrongColumns, indexes: canonicalIndexes() });
  await assert.rejects(
    () =>
      runUp({
        log: () => {},
        queryFn: wrongType.query,
        tableExistsFn: async () => true,
      }),
    /Unexpected type/,
  );
});

test("classes foundation adds only missing canonical indexes", async () => {
  const database = fakeDatabase({ indexes: [] });
  await runUp({
    log: () => {},
    queryFn: database.query,
    tableExistsFn: async () => true,
  });
  const alters = database.statements.filter((sql) => /^\s*ALTER TABLE/i.test(sql));
  assert.equal(alters.length, 3);
  for (const indexName of Object.keys(REQUIRED_INDEXES))
    assert.ok(alters.some((sql) => sql.includes(`ADD INDEX ${indexName}`)));
});

test("classes foundation rejects an incompatible canonical index", async () => {
  const database = fakeDatabase({
    indexes: [{ INDEX_NAME: "idx_j12_turmas_nome", columns: "status" }],
  });
  await assert.rejects(
    () =>
      runUp({
        log: () => {},
        queryFn: database.query,
        tableExistsFn: async () => true,
      }),
    /Incompatible existing index/,
  );
  assert.equal(
    database.statements.some((sql) => /^\s*ALTER TABLE/i.test(sql)),
    false,
  );
});

function fakeDatabase({
  columns = canonicalColumns(),
  engine = "InnoDB",
  indexes = canonicalIndexes(),
} = {}) {
  const state = { indexes: indexes.map((index) => ({ ...index })) };
  const statements = [];
  async function query(sql) {
    statements.push(sql);
    if (/information_schema\.tables/.test(sql)) return [{ ENGINE: engine }];
    if (/information_schema\.columns/.test(sql)) return columns.map((column) => ({ ...column }));
    if (/information_schema\.statistics/.test(sql))
      return state.indexes.map((index) => ({ ...index }));
    const match = /ADD INDEX\s+(\w+)\s+\(([^)]+)\)/i.exec(sql);
    if (match)
      state.indexes.push({
        INDEX_NAME: match[1],
        columns: match[2].replace(/\s+/g, ""),
      });
    return [];
  }
  return { query, statements };
}

function canonicalColumns() {
  return Object.entries(REQUIRED_COLUMNS).map(([COLUMN_NAME, expected]) => ({
    COLUMN_NAME,
    COLUMN_TYPE: expected === "integer" ? "bigint" : expected,
  }));
}

function canonicalIndexes() {
  return Object.entries(REQUIRED_INDEXES).map(([INDEX_NAME, columns]) => ({
    INDEX_NAME,
    columns,
  }));
}
