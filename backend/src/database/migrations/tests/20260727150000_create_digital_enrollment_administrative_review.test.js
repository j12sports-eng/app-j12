const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const REVIEWS_TABLE = "digital_enrollment_administrative_reviews";
const DECISIONS_TABLE =
  "digital_enrollment_administrative_review_decisions";
const COMMANDS_TABLE =
  "digital_enrollment_administrative_review_commands";
const TABLES = [REVIEWS_TABLE, DECISIONS_TABLE, COMMANDS_TABLE];

const state = {
  existingTables: new Set(),
  queries: [],
  rowCounts: new Map(),
  tableChecks: [],
};

const dbPath = path.resolve(__dirname, "../../../config/db.js");
require.cache[dbPath] = {
  exports: {
    pool: {
      async end() {
        throw new Error("The mocked pool must not be closed during module import.");
      },
    },
    async query(sql) {
      state.queries.push(sql);
      const countMatch = String(sql).match(
        /^SELECT COUNT\(\*\) AS total FROM ([a-z_]+)$/u,
      );
      if (countMatch) {
        return [{ total: state.rowCounts.get(countMatch[1]) || 0 }];
      }
      return [];
    },
    async tableExists(tableName) {
      state.tableChecks.push(tableName);
      return state.existingTables.has(tableName);
    },
  },
  filename: dbPath,
  id: dbPath,
  loaded: true,
};

const migrationPath = path.resolve(
  __dirname,
  "../20260727150000_create_digital_enrollment_administrative_review.js",
);
const migration = require(migrationPath);

test.beforeEach(() => {
  state.existingTables.clear();
  state.queries.length = 0;
  state.rowCounts.clear();
  state.tableChecks.length = 0;
});

test("exports the expected SQL constants and operations", () => {
  assert.deepEqual(Object.keys(migration).sort(), [
    "CREATE_COMMANDS_TABLE_SQL",
    "CREATE_DECISIONS_TABLE_SQL",
    "CREATE_REVIEWS_TABLE_SQL",
    "down",
    "status",
    "up",
  ]);
  assert.equal(typeof migration.CREATE_REVIEWS_TABLE_SQL, "string");
  assert.equal(typeof migration.CREATE_DECISIONS_TABLE_SQL, "string");
  assert.equal(typeof migration.CREATE_COMMANDS_TABLE_SQL, "string");
  assert.equal(typeof migration.up, "function");
  assert.equal(typeof migration.down, "function");
  assert.equal(typeof migration.status, "function");
});

test("reviews SQL declares the canonical MySQL 5.7 structure", () => {
  const sql = migration.CREATE_REVIEWS_TABLE_SQL;

  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${REVIEWS_TABLE}`));
  assert.match(sql, /ENGINE=InnoDB/u);
  assert.match(sql, /DEFAULT CHARSET=utf8mb4/u);
  assert.match(sql, /COLLATE=utf8mb4_unicode_ci/u);
  assert.match(sql, /PRIMARY KEY \(id\)/u);
  assert.match(sql, /UNIQUE INDEX ux_dear_enrollment \(enrollment_id\)/u);
  assert.match(sql, /REFERENCES enrollments\(id\)/u);
  assert.match(sql, /REFERENCES person_relationships\(id\)/u);
  assert.match(
    sql,
    /INDEX idx_dear_relationship \(responsible_relationship_id\)/u,
  );
  assert.match(sql, /INDEX idx_dear_status \(status\)/u);
  assert.match(sql, /INDEX idx_dear_updated_at \(updated_at\)/u);
  assert.match(sql, /submitted_at DATETIME\(3\) NOT NULL/u);
  assert.match(sql, /updated_at DATETIME\(3\) NOT NULL/u);
  assert.match(sql, /correction_items_json LONGTEXT NOT NULL/u);
  assert.doesNotMatch(
    sql,
    /FOREIGN KEY \(reviewer_auth_identity_id\)/u,
  );
});

test("decisions SQL declares immutable history relationships and indexes", () => {
  const sql = migration.CREATE_DECISIONS_TABLE_SQL;

  assert.match(
    sql,
    new RegExp(`CREATE TABLE IF NOT EXISTS ${DECISIONS_TABLE}`),
  );
  assert.match(
    sql,
    new RegExp(`REFERENCES ${REVIEWS_TABLE}\\(id\\)`),
  );
  assert.match(sql, /REFERENCES enrollments\(id\)/u);
  assert.match(sql, /INDEX idx_deard_review \(review_id\)/u);
  assert.match(sql, /INDEX idx_deard_enrollment \(enrollment_id\)/u);
  assert.match(sql, /INDEX idx_deard_status \(status\)/u);
  assert.match(sql, /INDEX idx_deard_decided_at \(decided_at\)/u);
  assert.match(sql, /INDEX idx_deard_command \(command_id\)/u);
  assert.match(sql, /correction_items_json LONGTEXT NOT NULL/u);
  assert.match(sql, /decided_at DATETIME\(3\) NOT NULL/u);
  assert.doesNotMatch(sql, /UNIQUE(?: INDEX)?[^(]*\(command_id\)/u);
});

test("commands SQL declares durable idempotency structure", () => {
  const sql = migration.CREATE_COMMANDS_TABLE_SQL;

  assert.match(
    sql,
    new RegExp(`CREATE TABLE IF NOT EXISTS ${COMMANDS_TABLE}`),
  );
  assert.match(sql, /command_id VARCHAR\(64\) NOT NULL/u);
  assert.match(sql, /PRIMARY KEY \(command_id\)/u);
  assert.match(sql, /fingerprint CHAR\(64\)/u);
  assert.match(sql, /CHARACTER SET ascii/u);
  assert.match(sql, /COLLATE ascii_bin/u);
  assert.match(sql, /REFERENCES enrollments\(id\)/u);
  assert.match(
    sql,
    new RegExp(`REFERENCES ${REVIEWS_TABLE}\\(id\\)`),
  );
  assert.match(sql, /INDEX idx_dearc_enrollment \(enrollment_id\)/u);
  assert.match(sql, /INDEX idx_dearc_review \(review_id\)/u);
  assert.match(sql, /INDEX idx_dearc_created_at \(created_at\)/u);
  assert.match(sql, /result_snapshot_json LONGTEXT NOT NULL/u);
});

test("status checks exactly the three expected tables and reports absence", async () => {
  const result = await migration.status();

  assert.deepEqual(result, {
    commandsTableExists: false,
    decisionsTableExists: false,
    reviewsTableExists: false,
  });
  assert.deepEqual(state.tableChecks, TABLES);
  assert.deepEqual(state.queries, []);
});

test("status reports all three existing tables", async () => {
  state.existingTables = new Set(TABLES);

  assert.deepEqual(await migration.status(), {
    commandsTableExists: true,
    decisionsTableExists: true,
    reviewsTableExists: true,
  });
  assert.deepEqual(state.tableChecks, TABLES);
});

test("up validates dependencies in order and executes the exported SQL in order", async () => {
  state.existingTables = new Set(["enrollments", "person_relationships"]);

  await migration.up();

  assert.deepEqual(state.tableChecks, [
    "enrollments",
    "person_relationships",
  ]);
  assert.deepEqual(state.queries, [
    migration.CREATE_REVIEWS_TABLE_SQL,
    migration.CREATE_DECISIONS_TABLE_SQL,
    migration.CREATE_COMMANDS_TABLE_SQL,
  ]);
});

test("up fails closed before creating tables when a dependency is absent", async (t) => {
  await t.test("enrollments", async () => {
    state.existingTables = new Set(["person_relationships"]);

    await assert.rejects(() => migration.up(), {
      message: "Required table enrollments does not exist.",
    });
    assert.deepEqual(state.tableChecks, ["enrollments"]);
    assert.deepEqual(state.queries, []);
  });

  await t.test("person_relationships", async () => {
    state.existingTables = new Set(["enrollments"]);

    await assert.rejects(() => migration.up(), {
      message: "Required table person_relationships does not exist.",
    });
    assert.deepEqual(state.tableChecks, [
      "enrollments",
      "person_relationships",
    ]);
    assert.deepEqual(state.queries, []);
  });
});

test("down ignores absent tables and uses DROP TABLE IF EXISTS in dependency order", async () => {
  await migration.down();

  assert.deepEqual(state.tableChecks, [
    COMMANDS_TABLE,
    DECISIONS_TABLE,
    REVIEWS_TABLE,
  ]);
  assert.deepEqual(state.queries, [
    `DROP TABLE IF EXISTS ${COMMANDS_TABLE}`,
    `DROP TABLE IF EXISTS ${DECISIONS_TABLE}`,
    `DROP TABLE IF EXISTS ${REVIEWS_TABLE}`,
  ]);
});

test("down counts every existing table before dropping any table", async () => {
  state.existingTables = new Set(TABLES);

  await migration.down();

  assert.deepEqual(state.queries, [
    `SELECT COUNT(*) AS total FROM ${COMMANDS_TABLE}`,
    `SELECT COUNT(*) AS total FROM ${DECISIONS_TABLE}`,
    `SELECT COUNT(*) AS total FROM ${REVIEWS_TABLE}`,
    `DROP TABLE IF EXISTS ${COMMANDS_TABLE}`,
    `DROP TABLE IF EXISTS ${DECISIONS_TABLE}`,
    `DROP TABLE IF EXISTS ${REVIEWS_TABLE}`,
  ]);
});

test("down refuses rollback without executing DROP when any table contains rows", async (t) => {
  for (const table of [COMMANDS_TABLE, DECISIONS_TABLE, REVIEWS_TABLE]) {
    await t.test(table, async () => {
      state.existingTables = new Set(TABLES);
      state.rowCounts = new Map([[table, 1]]);

      await assert.rejects(() => migration.down(), {
        message: `Refusing to drop ${table}: table contains 1 row(s).`,
      });
      assert.equal(
        state.queries.some((sql) => /^DROP TABLE/u.test(sql)),
        false,
      );
    });
  }
});

test("import is inert and runtime SQL has no data mutation statements", async () => {
  assert.equal(require.cache[migrationPath].loaded, true);
  assert.deepEqual(state.queries, []);
  assert.deepEqual(state.tableChecks, []);

  state.existingTables = new Set(["enrollments", "person_relationships"]);
  await migration.up();
  state.existingTables = new Set(TABLES);
  await migration.status();
  state.rowCounts.clear();
  await migration.down();

  for (const sql of state.queries) {
    assert.doesNotMatch(sql, /^\s*(?:INSERT|UPDATE|DELETE)\b/iu);
  }
});
