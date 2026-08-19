const assert = require("node:assert/strict");
const test = require("node:test");

const MIGRATION_PATH = require.resolve(
  "../20260729210000_add_people_digital_enrollment_fields.js",
);

const {
  PEOPLE_DIGITAL_ENROLLMENT_COLUMNS,
  PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS,
  createPeopleDigitalEnrollmentFieldsMigration,
} = require("../20260729210000_add_people_digital_enrollment_fields.js");

const EXPECTED_ADD_SQL = Object.freeze([
  "ALTER TABLE people ADD COLUMN birth_city VARCHAR(191) NULL",
  "ALTER TABLE people ADD COLUMN birth_state VARCHAR(50) NULL",
  "ALTER TABLE people ADD COLUMN nationality VARCHAR(191) NULL",
  "ALTER TABLE people ADD COLUMN blood_type VARCHAR(20) NULL",
]);

test("module import is query-free and default operations support the runner contract", async () => {
  const fake = createFakeDatabase();
  const databasePath = require.resolve("../../../config/db.js");
  const cachedDatabase = require.cache[databasePath];
  const cachedMigration = require.cache[MIGRATION_PATH];

  require.cache[databasePath] = {
    exports: { pool: { async end() {} }, query: fake.query },
    filename: databasePath,
    id: databasePath,
    loaded: true,
  };
  delete require.cache[MIGRATION_PATH];

  try {
    const migrationModule = require(MIGRATION_PATH);
    assert.deepEqual(fake.sql, []);

    const upResult = await migrationModule.up();
    assert.deepEqual(upResult.added, Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS));
    assert.deepEqual(
      fake.sql.filter((sql) => /^ALTER TABLE/iu.test(sql)),
      EXPECTED_ADD_SQL,
    );

    const statusResult = await migrationModule.status();
    assert.equal(statusResult.complete, true);

    const downResult = await migrationModule.down();
    assert.deepEqual(downResult.removed, [
      "blood_type",
      "nationality",
      "birth_state",
      "birth_city",
    ]);
  } finally {
    if (cachedDatabase) require.cache[databasePath] = cachedDatabase;
    else delete require.cache[databasePath];
    if (cachedMigration) require.cache[MIGRATION_PATH] = cachedMigration;
    else delete require.cache[MIGRATION_PATH];
  }
});

test("migration adds only four nullable canonical columns and rolls back empty fields", async () => {
  const fake = createFakeDatabase();
  const logged = [];
  const migration = createPeopleDigitalEnrollmentFieldsMigration({
    logger: (entry) => logged.push(entry),
    queryRunner: fake.query,
  });

  const result = await migration.up();
  assert.deepEqual(result.added.sort(), Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS).sort());
  assert.deepEqual(
    Object.keys(fake.columns).sort(),
    Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS).sort(),
  );
  assert.deepEqual(
    fake.sql.filter((sql) => /^ALTER TABLE people ADD COLUMN/iu.test(sql)),
    EXPECTED_ADD_SQL,
  );
  assert.equal(fake.sql.some((sql) => /(?:CREATE|INSERT|UPDATE|DELETE)/iu.test(sql)), false);
  assert.equal(fake.sql.some((sql) => /(?:INDEX|FOREIGN KEY)/iu.test(sql)), false);
  assert.deepEqual(
    logged.map((entry) => entry.column),
    Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS),
  );
  for (const metadata of Object.values(fake.columns)) {
    assert.equal(metadata.IS_NULLABLE, "YES");
  }

  const down = await migration.down();
  assert.equal(down.removed.length, 4);
  assert.deepEqual(fake.columns, {});
});

test("migration refuses missing or incompatible people schema", async () => {
  const missing = createFakeDatabase({ tableExists: false });
  await assert.rejects(
    () => createPeopleDigitalEnrollmentFieldsMigration({ queryRunner: missing.query }).up(),
    { code: PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.SCHEMA_UNSAFE },
  );

  const incompatible = createFakeDatabase();
  incompatible.columns.birth_city = {
    DATA_TYPE: "varchar",
    CHARACTER_MAXIMUM_LENGTH: 10,
    IS_NULLABLE: "YES",
  };
  await assert.rejects(
    () => createPeopleDigitalEnrollmentFieldsMigration({ queryRunner: incompatible.query }).up(),
    { code: PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.SCHEMA_UNSAFE },
  );
});

test("migration rollback refuses populated canonical fields", async () => {
  const fake = createFakeDatabase();
  const migration = createPeopleDigitalEnrollmentFieldsMigration({ queryRunner: fake.query });
  await migration.up();
  fake.populated = 1;
  await assert.rejects(() => migration.down(), {
    code: PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.DOWN_BLOCKED,
  });
  assert.equal(Object.keys(fake.columns).length, 4);
});

function createFakeDatabase({ tableExists = true } = {}) {
  const state = { columns: {}, populated: 0, sql: [], tableExists };
  state.query = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/gu, " ").trim();
    state.sql.push(compact);
    if (/information_schema\.tables/iu.test(compact))
      return state.tableExists ? [{ present: 1 }] : [];
    if (/information_schema\.columns/iu.test(compact)) {
      const metadata = state.columns[params[1]];
      return metadata ? [metadata] : [];
    }
    if (/^SELECT COUNT\(\*\)/iu.test(compact)) return [{ total: state.populated }];
    let match = /^ALTER TABLE people ADD COLUMN (\w+) VARCHAR\((\d+)\) NULL$/iu.exec(compact);
    if (match) {
      state.columns[match[1]] = {
        CHARACTER_MAXIMUM_LENGTH: Number(match[2]),
        DATA_TYPE: "varchar",
        IS_NULLABLE: "YES",
      };
      return { affectedRows: 0 };
    }
    match = /^ALTER TABLE people DROP COLUMN (\w+)$/iu.exec(compact);
    if (match) {
      delete state.columns[match[1]];
      return { affectedRows: 0 };
    }
    throw new Error("Unexpected SQL: " + compact);
  };
  return state;
}
