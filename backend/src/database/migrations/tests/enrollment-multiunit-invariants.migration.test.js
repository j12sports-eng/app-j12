const assert = require("node:assert/strict");
const test = require("node:test");

const migrationModule = require("../20260729180000_enforce_enrollment_multiunit_invariants.js");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies.js");

test("up replaces the global DRAFT index and creates current unit-scoped uniqueness", async () => {
  const fixture = createFixture();
  const migration = createMigration(fixture);

  const result = await migration.up();

  assert.deepEqual(fixture.indexes.get(migrationModule.OLD_DRAFT_INDEX).columns, [
    migrationModule.DRAFT_UNIT_COLUMN,
    "active_draft_student_person_id",
    "active_draft_student_profile_id",
  ]);
  assert.deepEqual(fixture.indexes.get(migrationModule.CURRENT_UNIQUE_INDEX).columns, [
    migrationModule.CURRENT_UNIT_COLUMN,
    migrationModule.CURRENT_STUDENT_PERSON_COLUMN,
    migrationModule.CURRENT_STUDENT_PROFILE_COLUMN,
  ]);
  assert.equal(result.diagnostics.legacyWithoutUnit, 3);
  assert.equal(result.generatedColumns[migrationModule.DRAFT_UNIT_COLUMN], true);
  assert.match(migrationModule.ADD_DRAFT_UNIT_COLUMN_SQL, /THEN unit_id ELSE NULL/u);
  assert.match(migrationModule.ADD_CURRENT_UNIQUE_INDEX_SQL, /UNIQUE INDEX/u);
  assert.doesNotMatch(fixture.ddl.join("\n"), /\b(?:INSERT|UPDATE|DELETE)\b/iu);
});

test("legacy NULL unit rows are diagnosed but do not trigger fallback or backfill", async () => {
  const fixture = createFixture({ legacyWithoutUnit: 17 });
  const result = await createMigration(fixture).up();

  assert.equal(result.diagnostics.legacyWithoutUnit, 17);
  assert.equal(
    fixture.calls.some(({ sql }) => /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(sql)),
    false,
  );
});

test("up fails before DDL for every incompatible modern data category", async (t) => {
  for (const category of [
    "activeDuplicateGroups",
    "currentConflictGroups",
    "draftDuplicateGroups",
    "incompleteModernOwnership",
    "orphanOwnership",
    "orphanUnits",
  ]) {
    await t.test(category, async () => {
      const fixture = createFixture({ [category]: 1 });
      await assert.rejects(() => createMigration(fixture).up(), {
        code: migrationModule.ERROR_CODES.DATA_UNSAFE,
      });
      assert.deepEqual(fixture.ddl, []);
    });
  }
});

test("up requires signed BIGINT unit compatibility and canonical foreign keys", async () => {
  const unsigned = createFixture();
  unsigned.columns.set("enrollments.unit_id", column("unit_id", "bigint unsigned", "YES"));
  await assert.rejects(() => createMigration(unsigned).up(), {
    code: migrationModule.ERROR_CODES.SCHEMA_UNSAFE,
  });
  assert.deepEqual(unsigned.ddl, []);

  const missingForeignKey = createFixture();
  missingForeignKey.foreignKeys = missingForeignKey.foreignKeys.filter(
    (foreignKey) => foreignKey.COLUMN_NAME !== "unit_id",
  );
  await assert.rejects(() => createMigration(missingForeignKey).up(), {
    code: migrationModule.ERROR_CODES.SCHEMA_UNSAFE,
  });
  assert.deepEqual(missingForeignKey.ddl, []);
});

test("diagnostics distinguish independent cross-unit DRAFTs from duplicates", async () => {
  const fixture = createFixture({ draftDuplicateGroupsAcrossUnits: 2 });
  const result = await createMigration(fixture).up();

  assert.equal(result.diagnostics.draftDuplicateGroups, 0);
  assert.equal(result.diagnostics.draftDuplicateGroupsAcrossUnits, 2);
  assert.deepEqual(
    fixture.indexes.get(migrationModule.OLD_DRAFT_INDEX).columns[0],
    migrationModule.DRAFT_UNIT_COLUMN,
  );
});

test("down fails closed instead of restoring the global index across unit identities", async () => {
  const fixture = createFixture({ draftDuplicateGroupsAcrossUnits: 1 });
  await createMigration(fixture).up();
  const ddlBefore = [...fixture.ddl];

  await assert.rejects(() => createMigration(fixture).down(), {
    code: migrationModule.ERROR_CODES.DATA_UNSAFE,
  });
  assert.deepEqual(fixture.ddl, ddlBefore);
});

test("migration dependency order includes ownership, relationships and canonical unit FK", () => {
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260729180000_enforce_enrollment_multiunit_invariants"],
    ["20260803123000_reconcile_enrollment_multiunit_invariants"],
  );
});

function createMigration(fixture) {
  return migrationModule.createEnrollmentMultiunitInvariantMigration({
    queryRunner: fixture.query,
    tableExists: async (tableName) => fixture.tables.has(tableName),
  });
}

function createFixture(overrides = {}) {
  const fixture = {
    calls: [],
    columns: new Map(),
    ddl: [],
    diagnostics: {
      activeDuplicateGroups: 0,
      currentConflictGroups: 0,
      draftDuplicateGroups: 0,
      draftDuplicateGroupsAcrossUnits: 0,
      incompleteModernOwnership: 0,
      legacyWithoutUnit: 3,
      modernWithValidUnit: 4,
      orphanOwnership: 0,
      orphanUnits: 0,
      ...overrides,
    },
    foreignKeys: [],
    indexes: new Map(),
    tables: new Set([
      "enrollments",
      "j12_unidades",
      "people",
      "person_profiles",
      "person_relationships",
    ]),
  };
  for (const [name, type] of Object.entries({
    deleted_at: "datetime",
    responsible_person_id: "varchar(64)",
    responsible_profile_id: "varchar(64)",
    responsible_relationship_id: "varchar(64)",
    status: "varchar(32)",
    student_person_id: "varchar(64)",
    student_profile_id: "varchar(64)",
    unit_id: "bigint",
  })) {
    fixture.columns.set(
      `enrollments.${name}`,
      column(name, type, name === "unit_id" ? "YES" : "NO"),
    );
  }
  fixture.columns.set("j12_unidades.id", column("id", "bigint", "NO"));
  fixture.columns.set(
    "enrollments.active_draft_student_person_id",
    generatedColumn("active_draft_student_person_id", "varchar(64)"),
  );
  fixture.columns.set(
    "enrollments.active_draft_student_profile_id",
    generatedColumn("active_draft_student_profile_id", "varchar(64)"),
  );
  fixture.indexes.set(migrationModule.OLD_DRAFT_INDEX, {
    columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
    nonUnique: 0,
  });
  fixture.foreignKeys = [
    foreignKey("student_person_id", "people"),
    foreignKey("student_profile_id", "person_profiles"),
    foreignKey("responsible_person_id", "people"),
    foreignKey("responsible_profile_id", "person_profiles"),
    foreignKey("responsible_relationship_id", "person_relationships"),
    foreignKey("unit_id", "j12_unidades"),
  ];

  const diagnosticsBySql = new Map(
    Object.entries(migrationModule.DIAGNOSTIC_QUERIES).map(([name, sql]) => [compact(sql), name]),
  );
  fixture.query = async (sql, params = []) => {
    const normalized = compact(sql);
    fixture.calls.push({ params, sql: normalized });
    if (/FROM information_schema\.columns/iu.test(normalized)) {
      const value = fixture.columns.get(`${params[0]}.${params[1]}`);
      return value ? [value] : [];
    }
    if (/FROM information_schema\.key_column_usage/iu.test(normalized)) {
      return fixture.foreignKeys;
    }
    if (/FROM information_schema\.statistics/iu.test(normalized)) {
      const value = fixture.indexes.get(params[1]);
      return value
        ? [{ INDEX_NAME: params[1], NON_UNIQUE: value.nonUnique, columns: value.columns.join(",") }]
        : [];
    }
    if (diagnosticsBySql.has(normalized)) {
      return [{ total: fixture.diagnostics[diagnosticsBySql.get(normalized)] }];
    }
    if (/COUNT\(DISTINCT unit_id\)/iu.test(normalized)) {
      return [{ total: fixture.diagnostics.draftDuplicateGroupsAcrossUnits }];
    }
    if (/^ALTER TABLE\b/iu.test(normalized)) {
      fixture.ddl.push(normalized);
      applyDdl(fixture, normalized);
      return { affectedRows: 0 };
    }
    throw new Error(`Unexpected SQL: ${normalized}`);
  };
  return fixture;
}

function applyDdl(fixture, sql) {
  const addColumn = sql.match(/ADD COLUMN ([a-z0-9_]+) (BIGINT|VARCHAR\(64\))/iu);
  if (addColumn) {
    fixture.columns.set(
      `enrollments.${addColumn[1]}`,
      generatedColumn(addColumn[1], addColumn[2].toLowerCase()),
    );
    return;
  }
  const dropColumn = sql.match(/DROP COLUMN ([a-z0-9_]+)/iu);
  if (dropColumn) {
    fixture.columns.delete(`enrollments.${dropColumn[1]}`);
    return;
  }
  const addIndex = sql.match(/ADD UNIQUE INDEX ([a-z0-9_]+) \((.+)\)/iu);
  if (addIndex) {
    fixture.indexes.set(addIndex[1], {
      columns: addIndex[2].split(",").map((value) => value.trim()),
      nonUnique: 0,
    });
    return;
  }
  const dropIndex = sql.match(/DROP INDEX ([a-z0-9_]+)/iu);
  if (dropIndex) fixture.indexes.delete(dropIndex[1]);
}

function column(name, type, nullable) {
  return {
    COLUMN_NAME: name,
    DATA_TYPE: type.replace(/\(.+$/u, ""),
    COLUMN_TYPE: type,
    EXTRA: "",
    IS_NULLABLE: nullable,
  };
}
function generatedColumn(name, type) {
  return {
    ...column(name, type, "YES"),
    EXTRA: "VIRTUAL GENERATED",
    GENERATION_EXPRESSION: "generated",
  };
}
function foreignKey(columnName, tableName) {
  return {
    COLUMN_NAME: columnName,
    REFERENCED_COLUMN_NAME: "id",
    REFERENCED_TABLE_NAME: tableName,
  };
}
function compact(sql) {
  return String(sql).replace(/\s+/gu, " ").trim();
}
