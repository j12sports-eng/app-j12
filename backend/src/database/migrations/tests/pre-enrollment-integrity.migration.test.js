const assert = require("node:assert/strict");
const test = require("node:test");

const migrationModule = require("../20260719200000_add_pre_enrollment_integrity_constraints.js");
const {
  INTEGRITY_MIGRATION_ERRORS,
  createPreEnrollmentIntegrityMigration,
} = migrationModule;

test("exports the up/down/status contract required by the canonical runner", () => {
  assert.equal(typeof migrationModule.up, "function");
  assert.equal(typeof migrationModule.down, "function");
  assert.equal(typeof migrationModule.status, "function");
});

test("default exports are lazy and delegate through the default factory", async () => {
  const fake = database();
  const { migration, restore } = loadModuleWithDefaultQuery(fake.query);
  try {
    assert.equal(fake.sql.length, 0);

    const before = await migration.status();
    const applied = await migration.up();
    const reverted = await migration.down();

    assert.equal(before.profileUniqueIndex, false);
    assert.equal(applied.profileUniqueIndex, true);
    assert.equal(applied.relationshipUniqueIndex, true);
    assert.equal(reverted.profileUniqueIndex, false);
    assert.equal(reverted.relationshipUniqueIndex, false);
  } finally {
    restore();
  }
});

test("up creates compatible profile and active-relationship uniqueness idempotently", async () => {
  const fake = database();
  const migration = createPreEnrollmentIntegrityMigration({ queryRunner: fake.query });
  const first = await migration.up();
  const alterCount = fake.sql.filter((sql) => /^ALTER TABLE/iu.test(sql)).length;
  const second = await migration.up();

  assert.equal(first.profileUniqueIndex, true);
  assert.equal(first.relationshipUniqueIndex, true);
  assert.equal(Object.values(first.generatedColumns).every(Boolean), true);
  assert.deepEqual(second, first);
  assert.equal(fake.sql.filter((sql) => /^ALTER TABLE/iu.test(sql)).length, alterCount);
});

test("up blocks every DDL when profile or relationship duplicates exist", async () => {
  for (const duplicates of [
    { profileGroups: 1, relationshipGroups: 0 },
    { profileGroups: 0, relationshipGroups: 2 },
  ]) {
    const fake = database({ duplicates });
    await assert.rejects(
      createPreEnrollmentIntegrityMigration({ queryRunner: fake.query }).up(),
      (error) =>
        error.code === INTEGRITY_MIGRATION_ERRORS.DUPLICATES_FOUND &&
        error.details.profileGroups === duplicates.profileGroups &&
        error.details.relationshipGroups === duplicates.relationshipGroups,
    );
    assert.equal(
      fake.sql.some((sql) => /^ALTER TABLE/iu.test(sql)),
      false,
    );
  }
});

test("status is read-only and reports an unapplied compatible schema", async () => {
  const fake = database();
  const result = await createPreEnrollmentIntegrityMigration({ queryRunner: fake.query }).status();
  assert.equal(result.profileUniqueIndex, false);
  assert.equal(result.relationshipUniqueIndex, false);
  assert.equal(
    Object.values(result.generatedColumns).every((value) => value === false),
    true,
  );
  assert.equal(
    fake.sql.every((sql) => /^SELECT\b/iu.test(sql)),
    true,
  );
});

test("down removes only indexes and generated columns, preserving rows", async () => {
  const fake = database();
  const migration = createPreEnrollmentIntegrityMigration({ queryRunner: fake.query });
  await migration.up();
  const result = await migration.down();

  assert.equal(result.profileUniqueIndex, false);
  assert.equal(result.relationshipUniqueIndex, false);
  assert.equal(
    fake.sql.some((sql) => /\b(DELETE|UPDATE|TRUNCATE)\b/iu.test(sql)),
    false,
  );
});

test("incompatible existing index fails closed", async () => {
  const fake = database();
  fake.indexes.set("person_profiles.ux_person_profiles_person_type", {
    NON_UNIQUE: 1,
    columns: "person_id,profile_type",
  });
  await assert.rejects(
    createPreEnrollmentIntegrityMigration({ queryRunner: fake.query }).up(),
    (error) => error.code === INTEGRITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
  );
});

function database(options = {}) {
  const state = {
    columns: new Map(),
    duplicates: { profileGroups: 0, relationshipGroups: 0, ...options.duplicates },
    indexes: new Map(),
    sql: [],
    tables: new Set(["person_profiles", "person_relationships"]),
  };
  for (const column of ["person_id", "profile_type"]) {
    state.columns.set(`person_profiles.${column}`, regularColumn(column));
  }
  for (const column of ["person_id", "related_person_id", "relationship_type", "status"]) {
    state.columns.set(`person_relationships.${column}`, regularColumn(column));
  }

  state.query = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/gu, " ").trim();
    state.sql.push(compact);
    if (/information_schema\.tables/iu.test(compact))
      return state.tables.has(params[0]) ? [{ 1: 1 }] : [];
    if (/information_schema\.columns/iu.test(compact))
      return state.columns.has(`${params[0]}.${params[1]}`)
        ? [state.columns.get(`${params[0]}.${params[1]}`)]
        : [];
    if (/information_schema\.statistics/iu.test(compact))
      return state.indexes.has(`${params[0]}.${params[1]}`)
        ? [state.indexes.get(`${params[0]}.${params[1]}`)]
        : [];
    if (/duplicate_profiles/iu.test(compact)) return [{ total: state.duplicates.profileGroups }];
    if (/duplicate_relationships/iu.test(compact))
      return [{ total: state.duplicates.relationshipGroups }];

    let match = /^ALTER TABLE (\w+) ADD UNIQUE INDEX (\w+) \(([^)]+)\)$/iu.exec(compact);
    if (match) {
      state.indexes.set(`${match[1]}.${match[2]}`, { NON_UNIQUE: 0, columns: match[3] });
      return { affectedRows: 0 };
    }
    match =
      /^ALTER TABLE (\w+) ADD COLUMN (\w+) VARCHAR\((\d+)\).*THEN (\w+) ELSE NULL END\) VIRTUAL$/iu.exec(
        compact,
      );
    if (match) {
      state.columns.set(`${match[1]}.${match[2]}`, generatedColumn(Number(match[3]), match[4]));
      return { affectedRows: 0 };
    }
    match = /^ALTER TABLE (\w+) DROP INDEX (\w+)$/iu.exec(compact);
    if (match) {
      state.indexes.delete(`${match[1]}.${match[2]}`);
      return { affectedRows: 0 };
    }
    match = /^ALTER TABLE (\w+) DROP COLUMN (\w+)$/iu.exec(compact);
    if (match) {
      state.columns.delete(`${match[1]}.${match[2]}`);
      return { affectedRows: 0 };
    }
    throw new Error(`Unexpected SQL: ${compact}`);
  };
  return state;
}

function regularColumn(column) {
  return {
    CHARACTER_MAXIMUM_LENGTH: column.includes("type") ? 50 : 64,
    DATA_TYPE: "varchar",
    EXTRA: "",
    GENERATION_EXPRESSION: "",
    IS_NULLABLE: "NO",
  };
}

function generatedColumn(length, source) {
  return {
    CHARACTER_MAXIMUM_LENGTH: length,
    DATA_TYPE: "varchar",
    EXTRA: "VIRTUAL GENERATED",
    GENERATION_EXPRESSION: `case when status = 'active' then ${source} else null end`,
    IS_NULLABLE: "YES",
  };
}

function loadModuleWithDefaultQuery(query) {
  const databasePath = require.resolve("../../../config/db.js");
  const migrationPath = require.resolve("../20260719200000_add_pre_enrollment_integrity_constraints.js");
  const cachedDatabase = require.cache[databasePath];
  const cachedMigration = require.cache[migrationPath];
  delete require.cache[migrationPath];
  require.cache[databasePath] = {
    exports: { query },
    filename: databasePath,
    id: databasePath,
    loaded: true,
  };

  return {
    migration: require(migrationPath),
    restore() {
      if (cachedMigration) require.cache[migrationPath] = cachedMigration;
      else delete require.cache[migrationPath];
      if (cachedDatabase) require.cache[databasePath] = cachedDatabase;
      else delete require.cache[databasePath];
    },
  };
}
