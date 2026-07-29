const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const state = {
  columns: new Map(),
  foreignKeys: [],
  indexes: new Map(),
  queries: [],
  tableChecks: [],
  tables: new Set(),
};

const dbPath = path.resolve(__dirname, "../../../config/db.js");
require.cache[dbPath] = {
  exports: {
    pool: { async end() {} },
    async query(sql, params = []) {
      const compactSql = compact(sql);
      state.queries.push({ params, sql: compactSql });

      if (/FROM information_schema\.columns/iu.test(compactSql)) {
        const [tableName, columnName] = params;
        const column = state.columns.get(`${tableName}.${columnName}`);
        return column ? [column] : [];
      }

      if (/FROM information_schema\.statistics/iu.test(compactSql)) {
        return indexRows(params[0]);
      }

      if (/FROM information_schema\.key_column_usage/iu.test(compactSql)) {
        return state.foreignKeys.map((foreignKey) => ({
          COLUMN_NAME: foreignKey.column,
          CONSTRAINT_NAME: foreignKey.name,
          REFERENCED_COLUMN_NAME: foreignKey.referencedColumn,
          REFERENCED_TABLE_NAME: foreignKey.referencedTable,
        }));
      }

      if (/ADD CONSTRAINT fk_enrollments_unit/iu.test(compactSql)) {
        state.foreignKeys.push(canonicalForeignKey());
        return { affectedRows: 0 };
      }

      if (/DROP FOREIGN KEY fk_enrollments_unit/iu.test(compactSql)) {
        state.foreignKeys = state.foreignKeys.filter(
          (foreignKey) => foreignKey.name !== migration.FOREIGN_KEY_NAME,
        );
        return { affectedRows: 0 };
      }

      throw new Error(`Unexpected SQL: ${compactSql}`);
    },
    async tableExists(tableName) {
      state.tableChecks.push(tableName);
      return state.tables.has(tableName);
    },
  },
  filename: dbPath,
  id: dbPath,
  loaded: true,
};

const migrationPath = path.resolve(
  __dirname,
  "../20260729150000_add_enrollment_unit_foreign_key.js",
);
const migration = require(migrationPath);
const { MIGRATION_FILE_PATTERN } = require("../../migration-runner/migration-catalog.js");

test.beforeEach(() => {
  resetState();
});

test("up creates only the canonical Enrollment unit foreign key", async () => {
  await migration.up();

  assert.deepEqual(ddlQueries(), [compact(migration.ADD_FOREIGN_KEY_SQL)]);
  assert.deepEqual(state.foreignKeys, [canonicalForeignKey()]);
  assert.equal(migration.FOREIGN_KEY_NAME, "fk_enrollments_unit");
  assert.match(
    migration.ADD_FOREIGN_KEY_SQL,
    /FOREIGN KEY \(unit_id\)\s+REFERENCES j12_unidades \(id\)/u,
  );
});

test("up is idempotent when the canonical foreign key already exists", async () => {
  state.foreignKeys.push(canonicalForeignKey());

  await migration.up();

  assert.deepEqual(ddlQueries(), []);
});

test("up is idempotent for an equivalent existing foreign key with another name", async () => {
  state.foreignKeys.push({
    ...canonicalForeignKey(),
    name: "fk_legacy_enrollments_unit",
  });

  await migration.up();

  assert.deepEqual(ddlQueries(), []);
});

test("up validates both required tables before reading schema", async (t) => {
  for (const missingTable of [migration.TABLE_NAME, migration.UNIT_TABLE_NAME]) {
    await t.test(missingTable, async () => {
      resetState();
      state.tables.delete(missingTable);

      await assert.rejects(() => migration.up(), {
        code: "ENROLLMENT_UNIT_FOREIGN_KEY_TABLE_MISSING",
        tableName: missingTable,
      });
      assert.deepEqual(state.queries, []);
    });
  }
});

test("up validates enrollments.unit_id and j12_unidades.id", async (t) => {
  for (const [tableName, columnName] of [
    [migration.TABLE_NAME, migration.UNIT_ID_COLUMN],
    [migration.UNIT_TABLE_NAME, migration.REFERENCED_ID_COLUMN],
  ]) {
    await t.test(`${tableName}.${columnName}`, async () => {
      resetState();
      state.columns.delete(`${tableName}.${columnName}`);

      await assert.rejects(() => migration.up(), {
        code: "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_MISSING",
        columnName,
        tableName,
      });
      assert.deepEqual(ddlQueries(), []);
    });
  }
});

test("up rejects signed or base type incompatibility before DDL", async (t) => {
  await t.test("unsigned child", async () => {
    state.columns.set("enrollments.unit_id", column("unit_id", "bigint unsigned", "YES"));

    await assert.rejects(() => migration.up(), {
      code: "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_INCOMPATIBLE",
    });
    assert.deepEqual(ddlQueries(), []);
  });

  await t.test("different parent type", async () => {
    resetState();
    state.columns.set("j12_unidades.id", column("id", "int", "NO", "int"));

    await assert.rejects(() => migration.up(), {
      code: "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_INCOMPATIBLE",
    });
    assert.deepEqual(ddlQueries(), []);
  });
});

test("up validates numeric charset/collation non-applicability", async () => {
  state.columns.set("enrollments.unit_id", {
    ...column("unit_id", "bigint", "YES"),
    CHARACTER_SET_NAME: "utf8mb4",
    COLLATION_NAME: "utf8mb4_unicode_ci",
  });

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up reuses the existing unit support index and creates no index", async () => {
  await migration.up();

  assert.equal(
    state.queries.some(({ sql }) => /\b(?:ADD|CREATE)\s+(?:UNIQUE\s+)?INDEX\b/iu.test(sql)),
    false,
  );

  resetState();
  state.indexes.delete("enrollments.idx_enrollments_unit_student_status");
  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_FOREIGN_KEY_SUPPORT_INDEX_MISSING",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up fails closed for an incompatible foreign key on unit_id", async () => {
  state.foreignKeys.push({
    column: "unit_id",
    name: migration.FOREIGN_KEY_NAME,
    referencedColumn: "id",
    referencedTable: "other_units",
  });

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_FOREIGN_KEY_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("down removes only the canonical foreign key", async () => {
  state.foreignKeys.push(canonicalForeignKey(), {
    column: "other_id",
    name: "fk_enrollments_other",
    referencedColumn: "id",
    referencedTable: "other_table",
  });
  const columnsBefore = new Map(state.columns);
  const indexesBefore = new Map(state.indexes);

  await migration.down();

  assert.deepEqual(ddlQueries(), [compact(migration.DROP_FOREIGN_KEY_SQL)]);
  assert.deepEqual(state.foreignKeys, [
    {
      column: "other_id",
      name: "fk_enrollments_other",
      referencedColumn: "id",
      referencedTable: "other_table",
    },
  ]);
  assert.deepEqual(state.columns, columnsBefore);
  assert.deepEqual(state.indexes, indexesBefore);
});

test("down is idempotent when the canonical foreign key is absent", async () => {
  await migration.down();

  assert.deepEqual(ddlQueries(), []);
});

test("migration never mutates columns, indexes or data", async () => {
  await migration.up();
  await migration.down();

  const sql = ddlQueries().join("\n");
  assert.doesNotMatch(sql, /\bADD COLUMN\b|\bDROP COLUMN\b/iu);
  assert.doesNotMatch(sql, /\bADD INDEX\b|\bCREATE INDEX\b|\bDROP INDEX\b/iu);
  assert.doesNotMatch(sql, /^\s*(?:INSERT|UPDATE|DELETE)\b/imu);
  assert.doesNotMatch(sql, /NOT NULL|DEFAULT/iu);
});

test("migration filename is canonical and later than the ownership foundation", () => {
  const filename = "20260729150000_add_enrollment_unit_foreign_key.js";

  assert.match(filename, MIGRATION_FILE_PATTERN);
  assert.equal(filename > "20260729120000_add_enrollment_unit_ownership_to_enrollments.js", true);
});

function resetState() {
  state.columns = new Map([
    ["enrollments.unit_id", column("unit_id", "bigint", "YES")],
    ["j12_unidades.id", column("id", "bigint", "NO")],
  ]);
  state.foreignKeys = [];
  state.indexes = new Map([
    [
      "enrollments.idx_enrollments_unit_student_status",
      {
        columns: ["unit_id", "student_person_id", "student_profile_id", "status", "deleted_at"],
        nonUnique: 1,
      },
    ],
    [
      "j12_unidades.PRIMARY",
      {
        columns: ["id"],
        nonUnique: 0,
      },
    ],
  ]);
  state.queries = [];
  state.tableChecks = [];
  state.tables = new Set(["enrollments", "j12_unidades"]);
}

function column(columnName, columnType, nullable, dataType = "bigint") {
  return {
    CHARACTER_SET_NAME: null,
    COLLATION_NAME: null,
    COLUMN_NAME: columnName,
    COLUMN_TYPE: columnType,
    DATA_TYPE: dataType,
    IS_NULLABLE: nullable,
  };
}

function canonicalForeignKey() {
  return {
    column: "unit_id",
    name: migration.FOREIGN_KEY_NAME,
    referencedColumn: "id",
    referencedTable: "j12_unidades",
  };
}

function indexRows(tableName) {
  return [...state.indexes.entries()]
    .filter(([key]) => key.startsWith(`${tableName}.`))
    .flatMap(([key, index]) => {
      const indexName = key.slice(tableName.length + 1);
      return index.columns.map((columnName, position) => ({
        COLUMN_NAME: columnName,
        INDEX_NAME: indexName,
        NON_UNIQUE: index.nonUnique,
        SEQ_IN_INDEX: position + 1,
      }));
    });
}

function ddlQueries() {
  return state.queries.map(({ sql }) => sql).filter((sql) => /^ALTER TABLE\b/iu.test(sql));
}

function compact(sql) {
  return String(sql).replace(/\s+/gu, " ").trim();
}
