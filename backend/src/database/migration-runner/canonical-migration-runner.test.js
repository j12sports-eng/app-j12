const assert = require("node:assert/strict");
const test = require("node:test");

const { CanonicalMigrationRunner } = require("./canonical-migration-runner.js");
const { buildMigrationCatalog, discoverMigrationCatalog } = require("./migration-catalog.js");
const { assertExplicitDatabaseTarget, parseArguments } = require("./cli.js");
const { LEDGER_TABLE, MySqlMigrationLedger } = require("./mysql-migration-ledger.js");

function catalog(...names) {
  return buildMigrationCatalog(
    names.map((fileName) => ({ content: `-- ${fileName}`, fileName, path: fileName })),
  );
}

test("catalog orders migrations deterministically and calculates stable SHA-256 checksums", () => {
  const result = catalog("20260702000000_second.sql", "20260701000000_first.sql");
  assert.deepEqual(
    result.map((item) => item.id),
    ["20260701000000_first", "20260702000000_second"],
  );
  assert.match(result[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(result[0].checksum, catalog("20260701000000_first.sql")[0].checksum);
});

test("default catalog discovers every current versioned migration", async () => {
  const result = await discoverMigrationCatalog();
  assert.equal(result.length, 12);
  assert.equal(result[0].id, "20260629134546_create_enrollments_table");
  assert.equal(result.at(-1).id, "20260712184500_create_auth_runtime_tables");
});
test("catalog rejects duplicate migration timestamps before execution", () => {
  assert.throws(
    () => catalog("20260701000000_first.sql", "20260701000000_second.js"),
    (error) => error.code === "MIGRATION_TIMESTAMP_DUPLICATE",
  );
});

test("runner applies a new migration and records its canonical ledger lifecycle", async () => {
  const migrations = catalog("20260701000000_first.sql");
  const ledger = new InMemoryLedger();
  const applied = [];
  const result = await new CanonicalMigrationRunner({
    catalog: migrations,
    executor: {
      async apply(item) {
        applied.push(item.id);
      },
    },
    ledger,
  }).up();
  assert.deepEqual(result.applied, [migrations[0].id]);
  assert.deepEqual(applied, [migrations[0].id]);
  assert.equal(ledger.records[0].status, "APPLIED");
  assert.equal(ledger.records[0].checksum, migrations[0].checksum);
});

test("runner skips an already applied migration with the same checksum", async () => {
  const migrations = catalog("20260701000000_first.sql");
  const ledger = new InMemoryLedger([
    { checksum: migrations[0].checksum, id: migrations[0].id, status: "APPLIED" },
  ]);
  let calls = 0;
  const result = await new CanonicalMigrationRunner({
    catalog: migrations,
    executor: {
      async apply() {
        calls += 1;
      },
    },
    ledger,
  }).up();
  assert.equal(calls, 0);
  assert.deepEqual(result.skipped, [migrations[0].id]);
});

test("runner fails closed when an applied migration checksum changed", async () => {
  const migrations = catalog("20260701000000_first.sql");
  const ledger = new InMemoryLedger([
    { checksum: "0".repeat(64), id: migrations[0].id, status: "APPLIED" },
  ]);
  await assert.rejects(
    () =>
      new CanonicalMigrationRunner({
        catalog: migrations,
        executor: { async apply() {} },
        ledger,
      }).up(),
    (error) => error.code === "MIGRATION_LEDGER_BLOCKED" && error.state === "CHECKSUM_MISMATCH",
  );
});

test("runner records FAILED and stops after an intermediate migration failure", async () => {
  const migrations = catalog(
    "20260701000000_first.sql",
    "20260702000000_second.sql",
    "20260703000000_third.sql",
  );
  const ledger = new InMemoryLedger();
  const calls = [];
  const runner = new CanonicalMigrationRunner({
    catalog: migrations,
    executor: {
      async apply(item) {
        calls.push(item.id);
        if (item.name === "second") throw new Error("controlled failure");
      },
    },
    ledger,
  });
  await assert.rejects(
    () => runner.up(),
    (error) => error.code === "MIGRATION_EXECUTION_FAILED",
  );
  assert.deepEqual(
    calls,
    migrations.slice(0, 2).map((item) => item.id),
  );
  assert.deepEqual(
    ledger.records.map((item) => item.status),
    ["APPLIED", "FAILED"],
  );
  assert.equal(ledger.records[1].errorMessage, "controlled failure");
});

test("runner lock prevents two concurrent runners", async () => {
  const migrations = catalog("20260701000000_first.sql");
  const ledger = new InMemoryLedger();
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const first = new CanonicalMigrationRunner({
    catalog: migrations,
    executor: {
      async apply() {
        await wait;
      },
    },
    ledger,
  }).up();
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    () =>
      new CanonicalMigrationRunner({
        catalog: migrations,
        executor: { async apply() {} },
        ledger,
      }).up(),
    (error) => error.code === "MIGRATION_LOCK_UNAVAILABLE",
  );
  release();
  await first;
});

test("dry-run is deterministic and performs zero ledger or executor mutations", async () => {
  const migrations = catalog("20260702000000_second.sql", "20260701000000_first.sql");
  const result = await new CanonicalMigrationRunner({ catalog: migrations }).up({ dryRun: true });
  assert.equal(result.dryRun, true);
  assert.deepEqual(
    result.plan.map((item) => item.id),
    migrations.map((item) => item.id),
  );
});

test("CLI requires exact database confirmation and explicit remote opt-in", () => {
  const parsed = parseArguments(["status", "--confirm-database=j12"]);
  assert.throws(
    () => assertExplicitDatabaseTarget(parsed, { DB_HOST: "db.example", DB_NAME: "other" }),
    (error) => error.code === "MIGRATION_DATABASE_CONFIRMATION_REQUIRED",
  );
  assert.throws(
    () => assertExplicitDatabaseTarget(parsed, { DB_HOST: "db.example", DB_NAME: "j12" }),
    (error) => error.code === "MIGRATION_REMOTE_DATABASE_BLOCKED",
  );
  assert.doesNotThrow(() =>
    assertExplicitDatabaseTarget(
      parseArguments(["status", "--confirm-database=j12", "--allow-remote"]),
      { DB_HOST: "db.example", DB_NAME: "j12" },
    ),
  );
});

test("MySQL ledger contract uses a unique timestamp and named server lock", async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ params, sql });
      if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }], []];
      return [{ affectedRows: 1 }, []];
    },
    release() {},
  };
  const ledger = new MySqlMigrationLedger({
    pool: {
      async execute() {
        return [[{ total: 0 }], []];
      },
      async getConnection() {
        return connection;
      },
    },
  });
  await ledger.withLock(async () => ledger.ensureLedger());
  const sql = calls.map((call) => call.sql).join("\n");
  assert.match(sql, /GET_LOCK/);
  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE}`));
  assert.match(sql, /PRIMARY KEY \(id\)/);
  assert.match(sql, /UNIQUE INDEX ux_j12_schema_migrations_timestamp/);
  assert.match(sql, /RELEASE_LOCK/);
});

class InMemoryLedger {
  constructor(records = []) {
    this.records = records.map((record) => ({ ...record }));
    this.locked = false;
  }
  async ensureLedger() {}
  async list() {
    return this.records.map((record) => ({ ...record }));
  }
  async withLock(work) {
    if (this.locked) {
      const error = new Error("locked");
      error.code = "MIGRATION_LOCK_UNAVAILABLE";
      throw error;
    }
    this.locked = true;
    try {
      return await work();
    } finally {
      this.locked = false;
    }
  }
  async markApplying(migration) {
    this.records.push({ checksum: migration.checksum, id: migration.id, status: "APPLYING" });
  }
  async markApplied(migration, appliedAt, executionMs) {
    const record = this.records.find((item) => item.id === migration.id);
    Object.assign(record, { appliedAt, executionMs, status: "APPLIED" });
  }
  async markFailed(migration, failedAt, errorMessage) {
    const record = this.records.find((item) => item.id === migration.id);
    Object.assign(record, { errorMessage, failedAt, status: "FAILED" });
  }
}
