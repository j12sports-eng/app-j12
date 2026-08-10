"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LEDGER_TABLE,
  MySqlMigrationLedger,
} = require("../../migration-runner/mysql-migration-ledger");
const { BaselineLedgerWriter } = require("../baseline-ledger-writer");

function migration(id, checksumCharacter) {
  return {
    id,
    timestamp: id.slice(0, 14),
    name: id.slice(15),
    checksum: checksumCharacter.repeat(64),
  };
}

function fakeLedger({ exists = false, records = [], registerError = null } = {}) {
  const state = {
    exists,
    records: records.map((record) => ({ ...record })),
    events: [],
    commits: 0,
    rollbacks: 0,
  };
  return {
    state,
    adapter: {
      async withLock(work) {
        state.events.push("lock");
        return work();
      },
      async exists() {
        state.events.push("exists");
        return state.exists;
      },
      async ensureLedger() {
        state.events.push("ensureLedger");
        state.exists = true;
      },
      async list() {
        state.events.push("list");
        return state.records.map((record) => ({ ...record }));
      },
      async withTransaction(work) {
        state.events.push("transaction:start");
        const snapshot = state.records.map((record) => ({ ...record }));
        try {
          const result = await work();
          state.commits += 1;
          state.events.push("transaction:commit");
          return result;
        } catch (error) {
          state.records = snapshot;
          state.rollbacks += 1;
          state.events.push("transaction:rollback");
          throw error;
        }
      },
      async registerBaseline(entry, appliedAt) {
        state.events.push(`register:${entry.id}`);
        if (registerError) throw registerError;
        state.records.push({
          id: entry.id,
          checksum: entry.checksum,
          status: "APPLIED",
          appliedAt,
        });
      },
    },
  };
}

test("writer cria somente o ledger canônico e registra em transação na ordem aprovada", async () => {
  const first = migration("20260101000000_first", "a");
  const second = migration("20260102000000_second", "b");
  const clockValue = new Date("2026-08-03T12:00:00.000Z");
  const ledger = fakeLedger();
  const writer = new BaselineLedgerWriter({
    ledger: ledger.adapter,
    clock: () => clockValue,
  });
  const result = await writer.execute([first, second]);
  assert.deepEqual(result, {
    ledgerCreated: true,
    ddlTransactionSeparated: true,
    recordsBefore: 0,
    recordsAfter: 2,
    insertedIds: [first.id, second.id],
    alreadyAppliedIds: [],
    writesPerformed: true,
  });
  assert.deepEqual(ledger.state.events, [
    "lock",
    "exists",
    "ensureLedger",
    "exists",
    "list",
    "transaction:start",
    "list",
    `register:${first.id}`,
    `register:${second.id}`,
    "list",
    "transaction:commit",
  ]);
  assert.equal(ledger.state.commits, 1);
  assert.equal(ledger.state.rollbacks, 0);
  assert.ok(ledger.state.records.every((record) => record.status === "APPLIED"));
  assert.ok(ledger.state.records.every((record) => record.appliedAt === clockValue));
});

test("writer é idempotente e não cria ledger, transação ou registro já aplicado", async () => {
  const selected = migration("20260101000000_first", "a");
  const ledger = fakeLedger({
    exists: true,
    records: [{ id: selected.id, checksum: selected.checksum, status: "APPLIED" }],
  });
  const result = await new BaselineLedgerWriter({ ledger: ledger.adapter }).execute([selected]);
  assert.equal(result.ledgerCreated, false);
  assert.equal(result.writesPerformed, false);
  assert.deepEqual(result.insertedIds, []);
  assert.deepEqual(result.alreadyAppliedIds, [selected.id]);
  assert.equal(ledger.state.events.includes("ensureLedger"), false);
  assert.equal(
    ledger.state.events.some((event) => event.startsWith("transaction:")),
    false,
  );
  assert.equal(
    ledger.state.events.some((event) => event.startsWith("register:")),
    false,
  );
});

test("writer bloqueia checksum ou status divergente antes de registrar", async () => {
  const selected = migration("20260101000000_first", "a");
  for (const existing of [
    { id: selected.id, checksum: "b".repeat(64), status: "APPLIED" },
    { id: selected.id, checksum: selected.checksum, status: "FAILED" },
  ]) {
    const ledger = fakeLedger({ exists: true, records: [existing] });
    await assert.rejects(
      new BaselineLedgerWriter({ ledger: ledger.adapter }).execute([selected]),
      (error) =>
        error.code ===
        (existing.status === "FAILED"
          ? "BASELINE_EXISTING_STATUS_INVALID"
          : "BASELINE_EXISTING_CHECKSUM_MISMATCH"),
    );
    assert.equal(
      ledger.state.events.some((event) => event.startsWith("register:")),
      false,
    );
  }
});

test("falha de insert provoca rollback e erro controlado", async () => {
  const selected = migration("20260101000000_first", "a");
  const insertError = Object.assign(new Error("insert failed"), { code: "ER_DUP_ENTRY" });
  const ledger = fakeLedger({ exists: true, registerError: insertError });
  await assert.rejects(
    new BaselineLedgerWriter({ ledger: ledger.adapter }).execute([selected]),
    (error) => error.code === "BASELINE_WRITE_FAILED",
  );
  assert.equal(ledger.state.commits, 0);
  assert.equal(ledger.state.rollbacks, 1);
  assert.deepEqual(ledger.state.records, []);
});

function mysqlHarness() {
  const state = {
    sql: [],
    begins: 0,
    commits: 0,
    rollbacks: 0,
    releases: 0,
  };
  const connection = {
    async execute(sql, params = []) {
      state.sql.push({ sql, params });
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }]];
      if (sql.startsWith("INSERT INTO")) return [{ affectedRows: 1 }];
      return [[]];
    },
    async beginTransaction() {
      state.begins += 1;
    },
    async commit() {
      state.commits += 1;
    },
    async rollback() {
      state.rollbacks += 1;
    },
    release() {
      state.releases += 1;
    },
  };
  return {
    state,
    pool: {
      async getConnection() {
        return connection;
      },
      async execute(sql, params) {
        return connection.execute(sql, params);
      },
    },
  };
}

test("adapter MySQL registra baseline somente no ledger oficial com campos APPLIED", async () => {
  const harness = mysqlHarness();
  const ledger = new MySqlMigrationLedger({ pool: harness.pool });
  const selected = migration("20260101000000_first", "a");
  const appliedAt = new Date("2026-08-03T12:00:00.000Z");
  await ledger.withLock(() => ledger.registerBaseline(selected, appliedAt));
  const insert = harness.state.sql.find(({ sql }) => sql.startsWith("INSERT INTO"));
  assert.ok(insert);
  assert.match(insert.sql, new RegExp(`INSERT INTO ${LEDGER_TABLE}`));
  assert.match(insert.sql, /'APPLIED'/);
  assert.match(insert.sql, /execution_ms/);
  assert.doesNotMatch(insert.sql, /ALTER TABLE|DROP TABLE|UPDATE alunos|INSERT INTO alunos/i);
  assert.deepEqual(insert.params, [
    selected.id,
    selected.timestamp,
    selected.name,
    selected.checksum,
    appliedAt,
    appliedAt,
  ]);
  assert.equal(harness.state.releases, 1);
});

test("adapter MySQL rearma FAILED para APPLYING somente com checksum exato", async () => {
  const calls = [];

  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (/GET_LOCK/iu.test(sql)) {
        return [[{ acquired: 1 }], []];
      }

      if (/RELEASE_LOCK/iu.test(sql)) {
        return [[{ released: 1 }], []];
      }

      if (/UPDATE j12_schema_migrations/iu.test(sql)) {
        return [{ affectedRows: 1 }, []];
      }

      return [{ affectedRows: 1 }, []];
    },

    release() {},
  };

  const ledger = new MySqlMigrationLedger({
    pool: {
      async getConnection() {
        return connection;
      },
    },
  });

  const selected = migration("20260724123000_create_user_unit_memberships_table", "b");
  const startedAt = new Date("2026-08-10T18:30:00.000Z");

  await ledger.withLock(() => ledger.markRetryApplying(selected, startedAt));

  const update = calls.find(({ sql }) => /UPDATE j12_schema_migrations/iu.test(sql));

  assert.ok(update);
  assert.match(update.sql, /status = 'APPLYING'/u);
  assert.match(update.sql, /status = 'FAILED'/u);
  assert.match(update.sql, /applied_at IS NULL/u);
  assert.match(update.sql, /failed_at = NULL/u);
  assert.match(update.sql, /checksum = \?/u);

  assert.deepEqual(update.params, [startedAt, selected.id, selected.checksum]);

  assert.match(calls.map(({ sql }) => sql).join("\n"), /GET_LOCK/u);

  assert.match(calls.map(({ sql }) => sql).join("\n"), /RELEASE_LOCK/u);
});
test("adapter MySQL faz rollback da transação e sempre libera o lock", async () => {
  const harness = mysqlHarness();
  const ledger = new MySqlMigrationLedger({ pool: harness.pool });
  await assert.rejects(
    ledger.withLock(() =>
      ledger.withTransaction(async () => {
        throw new Error("transaction failure");
      }),
    ),
    /transaction failure/,
  );
  assert.equal(harness.state.begins, 1);
  assert.equal(harness.state.commits, 0);
  assert.equal(harness.state.rollbacks, 1);
  assert.equal(harness.state.releases, 1);
});
