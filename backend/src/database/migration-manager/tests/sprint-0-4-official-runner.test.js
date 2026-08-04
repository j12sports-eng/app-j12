"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { CanonicalMigrationRunner } = require("../../migration-runner/canonical-migration-runner");
const { MigrationExecutor } = require("../../migration-runner/migration-executor");
const {
  MySqlMigrationLedger,
  LEDGER_TABLE,
} = require("../../migration-runner/mysql-migration-ledger");
const { createApplyOneWriteClient } = require("../apply-one-database-client");

test("cliente de write compõe runner, executor e ledger oficiais sem consultar banco", async () => {
  let calls = 0;
  let closed = 0;
  const pool = {
    getConnection() {
      calls += 1;
    },
    async end() {
      closed += 1;
    },
  };
  const client = await createApplyOneWriteClient(
    { database: "j12", host: "localhost" },
    {
      createPool() {
        return pool;
      },
      catalogLoader: async () => [],
    },
  );
  assert.ok(client.runner instanceof CanonicalMigrationRunner);
  assert.ok(client.runner.executor instanceof MigrationExecutor);
  assert.ok(client.runner.ledger instanceof MySqlMigrationLedger);
  assert.equal(calls, 0);
  await client.close();
  assert.equal(closed, 1);
});

test("applyOne usa executor e ledger oficiais e atualiza somente o ID selecionado", async () => {
  const storage = createLedgerStorage();
  const calls = [];
  const selected = migration("20260803120000_selected");
  const outside = migration("20260803130000_outside");
  const executor = new MigrationExecutor({
    requireModule(modulePath) {
      return {
        async up() {
          calls.push(modulePath);
        },
      };
    },
  });
  const runner = new CanonicalMigrationRunner({
    catalog: [selected, outside],
    executor,
    ledger: new MySqlMigrationLedger({ pool: storage.pool }),
  });

  const result = await runner.applyOne(selected.id);

  assert.deepEqual(result.applied, [selected.id]);
  assert.deepEqual(calls, [selected.path]);
  assert.deepEqual(storage.records, [
    {
      id: selected.id,
      checksum: selected.checksum,
      status: "APPLIED",
      applied_at: storage.records[0].applied_at,
    },
  ]);
  const sql = storage.sql.join("\n");
  assert.match(sql, new RegExp(`INSERT INTO ${LEDGER_TABLE}`));
  assert.match(sql, /status = 'APPLIED'/u);
  assert.doesNotMatch(sql, new RegExp(outside.id));
});

test("falha da migration marca FAILED e nunca APPLIED", async () => {
  const storage = createLedgerStorage();
  const selected = migration("20260803120000_selected");
  const runner = new CanonicalMigrationRunner({
    catalog: [selected],
    executor: new MigrationExecutor({
      requireModule() {
        return {
          async up() {
            throw new Error("falha simulada");
          },
        };
      },
    }),
    ledger: new MySqlMigrationLedger({ pool: storage.pool }),
  });

  await assert.rejects(
    () => runner.applyOne(selected.id),
    (error) => error.code === "MIGRATION_EXECUTION_FAILED",
  );
  assert.equal(storage.records[0].status, "FAILED");
  assert.equal(storage.records[0].applied_at, null);
  assert.match(storage.sql.join("\n"), /status = 'FAILED'/u);
});

test("runner bloqueia dependência pendente e não chama executor", async () => {
  const dependency = migration("20260803110000_dependency");
  const selected = { ...migration("20260803120000_selected"), dependencies: [dependency.id] };
  let executorCalls = 0;
  const ledger = memoryLedger();
  const runner = new CanonicalMigrationRunner({
    catalog: [dependency, selected],
    executor: {
      async apply() {
        executorCalls += 1;
      },
    },
    ledger,
  });
  await assert.rejects(
    () => runner.applyOne(selected.id),
    (error) => error.code === "MIGRATION_APPLY_ONE_DEPENDENCY_PENDING",
  );
  assert.equal(executorCalls, 0);
  assert.equal(ledger.records.length, 0);
});

function migration(id) {
  return {
    id,
    name: id.slice(15),
    fileName: `${id}.js`,
    path: `fake/${id}.js`,
    extension: "js",
    timestamp: id.slice(0, 14),
    checksum: id.endsWith("outside") ? "b".repeat(64) : "a".repeat(64),
    dependencies: [],
  };
}

function createLedgerStorage() {
  const records = [];
  const sql = [];
  const connection = {
    async execute(statement, params = []) {
      const normalized = String(statement).replace(/\s+/gu, " ").trim();
      sql.push(normalized);
      if (/GET_LOCK/iu.test(normalized)) return [[{ acquired: 1 }], []];
      if (/RELEASE_LOCK/iu.test(normalized)) return [[{ released: 1 }], []];
      if (/information_schema\.tables/iu.test(normalized)) return [[{ total: 1 }], []];
      if (
        new RegExp(`^SELECT id, checksum, status, applied_at FROM ${LEDGER_TABLE}`, "iu").test(
          normalized,
        )
      )
        return [records.map((record) => ({ ...record })), []];
      if (new RegExp(`^CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE}`, "iu").test(normalized))
        return [{ affectedRows: 0 }, []];
      if (new RegExp(`^INSERT INTO ${LEDGER_TABLE}`, "iu").test(normalized)) {
        records.push({
          id: params[0],
          checksum: params[3],
          status: "APPLYING",
          applied_at: null,
        });
        return [{ affectedRows: 1 }, []];
      }
      if (/SET status = 'APPLIED'/iu.test(normalized)) {
        const record = records.find((entry) => entry.id === params[2]);
        Object.assign(record, { status: "APPLIED", applied_at: params[0] });
        return [{ affectedRows: 1 }, []];
      }
      if (/SET status = 'FAILED'/iu.test(normalized)) {
        const record = records.find((entry) => entry.id === params[2]);
        Object.assign(record, { status: "FAILED" });
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`SQL inesperado: ${normalized}`);
    },
    release() {},
  };
  return {
    records,
    sql,
    pool: {
      async getConnection() {
        return connection;
      },
    },
  };
}

function memoryLedger() {
  return {
    records: [],
    async withLock(work) {
      return work();
    },
    async ensureLedger() {},
    async list() {
      return this.records;
    },
    async markApplying(migrationEntry) {
      this.records.push({
        id: migrationEntry.id,
        checksum: migrationEntry.checksum,
        status: "APPLYING",
      });
    },
    async markApplied() {},
    async markFailed() {},
  };
}
