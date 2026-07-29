const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const state = {
  columns: new Map(),
  foreignKeys: [],
  generatedColumns: [],
  indexes: new Map(),
  queries: [],
  tableChecks: [],
  tableExists: true,
};

const dbPath = path.resolve(__dirname, "../../../config/db.js");
require.cache[dbPath] = {
  exports: {
    pool: { async end() {} },
    async query(sql, params = []) {
      const compactSql = String(sql).replace(/\s+/gu, " ").trim();
      state.queries.push({ params, sql: compactSql });

      if (/FROM information_schema\.statistics/iu.test(compactSql)) {
        return indexRows();
      }

      if (/FROM information_schema\.key_column_usage/iu.test(compactSql)) {
        return state.foreignKeys.map((foreignKey) => ({
          COLUMN_NAME: "unit_id",
          CONSTRAINT_NAME: foreignKey.name,
          REFERENCED_COLUMN_NAME: foreignKey.referencedColumn || "id",
          REFERENCED_TABLE_NAME: foreignKey.referencedTable || "j12_unidades",
        }));
      }

      if (
        /FROM information_schema\.columns/iu.test(compactSql) &&
        /GENERATION_EXPRESSION IS NOT NULL/iu.test(compactSql)
      ) {
        return state.generatedColumns.map((column) => ({
          COLUMN_NAME: column.name,
          GENERATION_EXPRESSION: column.expression,
        }));
      }

      if (/FROM information_schema\.columns/iu.test(compactSql)) {
        return params
          .slice(1)
          .map((columnName) => state.columns.get(columnName))
          .filter(Boolean);
      }

      if (/ADD COLUMN unit_id BIGINT NULL/iu.test(compactSql)) {
        state.columns.set("unit_id", canonicalUnitColumn());
        return { affectedRows: 0 };
      }

      if (/ADD INDEX idx_enrollments_unit_student_status/iu.test(compactSql)) {
        state.indexes.set("idx_enrollments_unit_student_status", {
          columns: [...migration.EXPECTED_SUPPORT_INDEX_COLUMNS],
          nonUnique: 1,
        });
        return { affectedRows: 0 };
      }

      if (/DROP INDEX idx_enrollments_unit_student_status/iu.test(compactSql)) {
        state.indexes.delete("idx_enrollments_unit_student_status");
        return { affectedRows: 0 };
      }

      if (/DROP COLUMN unit_id/iu.test(compactSql)) {
        state.columns.delete("unit_id");
        return { affectedRows: 0 };
      }

      throw new Error(`Unexpected SQL: ${compactSql}`);
    },
    async tableExists(tableName) {
      state.tableChecks.push(tableName);
      return state.tableExists;
    },
  },
  filename: dbPath,
  id: dbPath,
  loaded: true,
};

const migrationPath = path.resolve(
  __dirname,
  "../20260729120000_add_enrollment_unit_ownership_to_enrollments.js",
);
const migration = require(migrationPath);
const { MIGRATION_FILE_PATTERN } = require("../../migration-runner/migration-catalog.js");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

test.beforeEach(() => {
  resetState();
});

test("up adds nullable signed BIGINT unit_id when the column is absent", async () => {
  await migration.up();

  assert.deepEqual(ddlQueries(), [
    compact(migration.ADD_UNIT_ID_COLUMN_SQL),
    compact(migration.ADD_SUPPORT_INDEX_SQL),
  ]);
  assert.deepEqual(state.columns.get("unit_id"), canonicalUnitColumn());
  assert.match(migration.ADD_UNIT_ID_COLUMN_SQL, /ADD COLUMN unit_id BIGINT NULL/u);
  assert.match(migration.ADD_UNIT_ID_COLUMN_SQL, /AFTER student_profile_id/u);
});

test("up creates the exact non-unique unit/student/status support index", async () => {
  await migration.up();

  assert.deepEqual(state.indexes.get(migration.SUPPORT_INDEX_NAME), {
    columns: ["unit_id", "student_person_id", "student_profile_id", "status", "deleted_at"],
    nonUnique: 1,
  });
  assert.doesNotMatch(migration.ADD_SUPPORT_INDEX_SQL, /\bUNIQUE\b/iu);
});

test("migration DDL applies no NOT NULL, FK, backfill or data mutation", async () => {
  await migration.up();

  const mutationSql = [
    migration.ADD_UNIT_ID_COLUMN_SQL,
    migration.ADD_SUPPORT_INDEX_SQL,
    migration.DROP_SUPPORT_INDEX_SQL,
    migration.DROP_UNIT_ID_COLUMN_SQL,
  ].join("\n");

  assert.doesNotMatch(migration.ADD_UNIT_ID_COLUMN_SQL, /NOT NULL|DEFAULT/iu);
  assert.doesNotMatch(mutationSql, /FOREIGN KEY|REFERENCES|ON DELETE|ON UPDATE/iu);
  assert.doesNotMatch(mutationSql, /\b(?:INSERT|UPDATE|DELETE)\b/iu);
  assert.doesNotMatch(mutationSql, /ux_enrollments_active_draft_student_profile/iu);
  assert.equal(
    state.queries.some(({ sql }) => /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(sql)),
    false,
  );
});

test("up is idempotent when the column and index already have the canonical shape", async () => {
  installCanonicalOwnershipSchema();

  await migration.up();

  assert.deepEqual(ddlQueries(), []);
});

test("up fails closed when unit_id already exists as VARCHAR", async () => {
  state.columns.set("unit_id", incompatibleUnitColumn("varchar(64)", "varchar"));

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_COLUMN_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up fails closed when unit_id already exists as INT", async () => {
  state.columns.set("unit_id", incompatibleUnitColumn("int", "int"));

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_COLUMN_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up fails closed when unit_id is BIGINT UNSIGNED", async () => {
  state.columns.set("unit_id", incompatibleUnitColumn("bigint unsigned", "bigint"));

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_COLUMN_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up rejects a same-name index with a different column sequence", async () => {
  state.columns.set("unit_id", canonicalUnitColumn());
  state.indexes.set(migration.SUPPORT_INDEX_NAME, {
    columns: ["unit_id", "status", "student_person_id"],
    nonUnique: 1,
  });

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_INDEX_INCOMPATIBLE",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("down removes only the owned support index and unit_id column", async () => {
  installCanonicalOwnershipSchema();
  state.indexes.set("idx_enrollments_status", {
    columns: ["status"],
    nonUnique: 1,
  });

  await migration.down();

  assert.deepEqual(ddlQueries(), [
    compact(migration.DROP_SUPPORT_INDEX_SQL),
    compact(migration.DROP_UNIT_ID_COLUMN_SQL),
  ]);
  assert.equal(state.indexes.has("idx_enrollments_status"), true);
  assert.equal(state.indexes.has(migration.SUPPORT_INDEX_NAME), false);
  assert.equal(state.columns.has("unit_id"), false);
});

test("down is idempotent when the owned index and column are already absent", async () => {
  await migration.down();

  assert.deepEqual(ddlQueries(), []);
});

test("down fails before DDL when an unknown index depends on unit_id", async () => {
  installCanonicalOwnershipSchema();
  state.indexes.set("idx_unexpected_unit_dependency", {
    columns: ["unit_id", "created_at"],
    nonUnique: 1,
  });

  await assert.rejects(() => migration.down(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_ROLLBACK_BLOCKED",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("down fails before DDL when a foreign key depends on unit_id", async () => {
  installCanonicalOwnershipSchema();
  state.foreignKeys.push({
    name: "fk_unexpected_enrollment_unit",
    referencedColumn: "id",
    referencedTable: "j12_unidades",
  });

  await assert.rejects(() => migration.down(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_ROLLBACK_BLOCKED",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("down fails before DDL when a generated column depends on unit_id", async () => {
  installCanonicalOwnershipSchema();
  state.generatedColumns.push({
    expression: "if((`unit_id` is not null),`unit_id`,NULL)",
    name: "unexpected_generated_unit",
  });

  await assert.rejects(() => migration.down(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_ROLLBACK_BLOCKED",
  });
  assert.deepEqual(ddlQueries(), []);
});

test("up fails clearly and executes no SQL when enrollments does not exist", async () => {
  state.tableExists = false;

  await assert.rejects(() => migration.up(), {
    code: "ENROLLMENT_UNIT_OWNERSHIP_TABLE_MISSING",
    message: "Required table enrollments does not exist.",
  });
  assert.deepEqual(state.tableChecks, ["enrollments"]);
  assert.deepEqual(state.queries, []);
});

test("migration has a unique catalog id and only the Enrollment foundation dependency", () => {
  assert.match(
    "20260729120000_add_enrollment_unit_ownership_to_enrollments.js",
    MIGRATION_FILE_PATTERN,
  );
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260729120000_add_enrollment_unit_ownership_to_enrollments"],
    ["20260629134546_create_enrollments_table"],
  );
  assert.equal(
    MIGRATION_DEPENDENCIES["20260729120000_add_enrollment_unit_ownership_to_enrollments"].includes(
      "20260725160000_create_digital_enrollment_contract_foundation",
    ),
    false,
  );
});

function resetState() {
  state.columns = new Map([
    ["student_person_id", { COLUMN_NAME: "student_person_id" }],
    ["student_profile_id", { COLUMN_NAME: "student_profile_id" }],
    ["status", { COLUMN_NAME: "status" }],
    ["deleted_at", { COLUMN_NAME: "deleted_at" }],
  ]);
  state.foreignKeys = [];
  state.generatedColumns = [];
  state.indexes = new Map();
  state.queries = [];
  state.tableChecks = [];
  state.tableExists = true;
}

function installCanonicalOwnershipSchema() {
  state.columns.set("unit_id", canonicalUnitColumn());
  state.indexes.set(migration.SUPPORT_INDEX_NAME, {
    columns: [...migration.EXPECTED_SUPPORT_INDEX_COLUMNS],
    nonUnique: 1,
  });
}

function canonicalUnitColumn() {
  return {
    COLUMN_DEFAULT: null,
    COLUMN_NAME: "unit_id",
    COLUMN_TYPE: "bigint",
    DATA_TYPE: "bigint",
    EXTRA: "",
    GENERATION_EXPRESSION: "",
    IS_NULLABLE: "YES",
  };
}

function incompatibleUnitColumn(columnType, dataType) {
  return {
    ...canonicalUnitColumn(),
    COLUMN_TYPE: columnType,
    DATA_TYPE: dataType,
  };
}

function indexRows() {
  return [...state.indexes.entries()].flatMap(([indexName, index]) =>
    index.columns.map((columnName, indexPosition) => ({
      COLUMN_NAME: columnName,
      INDEX_NAME: indexName,
      NON_UNIQUE: index.nonUnique,
      SEQ_IN_INDEX: indexPosition + 1,
    })),
  );
}

function ddlQueries() {
  return state.queries.map(({ sql }) => sql).filter((sql) => /^ALTER TABLE\b/iu.test(sql));
}

function compact(sql) {
  return String(sql).replace(/\s+/gu, " ").trim();
}
