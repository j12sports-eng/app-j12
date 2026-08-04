"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { computeBaselineToken } = require("../baseline-token");
const { assessWriteRequest, executeControlledBaseline } = require("../baseline-write-manager");

function migration(id, overrides = {}) {
  return {
    id,
    name: id.slice(15),
    fileName: `${id}.sql`,
    checksum: "a".repeat(64),
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    ledgerStatus: null,
    checksumMatches: null,
    physicalState: PHYSICAL_STATES.PRESENT,
    structuralDrift: false,
    driftDetected: true,
    manifestAvailable: true,
    ...overrides,
  };
}

function state(migrations, { domainVersion = 1, ledgerExists = false } = {}) {
  const applied = migrations.filter((entry) => entry.ledgerState === LEDGER_STATES.APPLIED).length;
  return {
    doctorReport: {
      generatedAt: "2026-08-03T12:00:00.000Z",
      database: { host: "localhost", name: "j12", remote: false },
      schemaSnapshot: {
        tables: {
          ...(ledgerExists ? { j12_schema_migrations: { columns: ["id"] } } : {}),
          people: { columns: ["id"], version: domainVersion },
        },
      },
      summary: {
        ledgerApplied: applied,
        ledgerPending: migrations.length - applied,
        physicallyPresent: migrations.length,
        partiallyPresent: 0,
        physicallyAbsent: 0,
        unknown: 0,
        severityCounts: { INFO: 0, WARNING: 0, HIGH: 0, CRITICAL: 0 },
      },
      migrations,
      findings: [],
      expectedSchema: [],
    },
    canonicalPlan: migrations.map((entry) => ({
      id: entry.id,
      dependencies: entry.dependencies,
    })),
    runner: { reused: true, dryRun: true, migrations: migrations.length },
  };
}

function appliedCopy(entry) {
  return {
    ...entry,
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    checksumMatches: true,
    driftDetected: false,
  };
}

test("write controlado revalida duas vezes, escreve uma vez e valida sem aplicar migration", async () => {
  let migrationUpCalls = 0;
  const selected = migration("20260101000000_people", {
    async up() {
      migrationUpCalls += 1;
    },
  });
  const before = state([selected]);
  const after = state([appliedCopy(selected)], { ledgerExists: true });
  const collected = [before, before, after];
  let collections = 0;
  let factories = 0;
  let writerCalls = 0;
  let closes = 0;
  const token = computeBaselineToken("j12", [selected]);
  const result = await executeControlledBaseline({
    async stateCollector() {
      return collected[collections++];
    },
    async writeClientFactory() {
      factories += 1;
      return {
        writer: {
          async execute(migrations) {
            writerCalls += 1;
            assert.deepEqual(
              migrations.map((entry) => entry.id),
              [selected.id],
            );
            return {
              ledgerCreated: true,
              ddlTransactionSeparated: true,
              recordsBefore: 0,
              recordsAfter: 1,
              insertedIds: [selected.id],
              alreadyAppliedIds: [],
              writesPerformed: true,
            };
          },
        },
        async close() {
          closes += 1;
        },
      };
    },
    context: { reader: { fake: true } },
    onlyIds: [selected.id],
    confirmationToken: token,
    clock: () => new Date("2026-08-03T12:30:00.000Z"),
  });
  assert.equal(collections, 3);
  assert.equal(factories, 1);
  assert.equal(writerCalls, 1);
  assert.equal(closes, 1);
  assert.equal(migrationUpCalls, 0);
  assert.equal(result.mode, "WRITE");
  assert.deepEqual(result.registeredIds, [selected.id]);
  assert.equal(result.tokenConfirmed, token);
  assert.equal(result.postValidation.passed, true);
  assert.equal(result.postValidation.checks.domainSchemaUnchanged, true);
});

test("token inválido bloqueia antes de criar cliente de escrita", async () => {
  const selected = migration("20260101000000_people");
  let collections = 0;
  let factories = 0;
  await assert.rejects(
    executeControlledBaseline({
      async stateCollector() {
        collections += 1;
        return state([selected]);
      },
      async writeClientFactory() {
        factories += 1;
      },
      context: {},
      onlyIds: [selected.id],
      confirmationToken: "invalid",
    }),
    (error) => error.code === "BASELINE_CONFIRMATION_MISMATCH",
  );
  assert.equal(collections, 1);
  assert.equal(factories, 0);
});

test("lista incompleta, extra, duplicada ou fora da ordem canônica é bloqueada", () => {
  const first = migration("20260101000000_first");
  const second = migration("20260102000000_second");
  const current = state([first, second]);
  const cases = [
    { onlyIds: [first.id], code: "BASELINE_ONLY_MISMATCH" },
    { onlyIds: [first.id, "20260103000000_extra"], code: "BASELINE_ONLY_EXTRA" },
    { onlyIds: [first.id, first.id], code: "BASELINE_ONLY_DUPLICATE" },
    { onlyIds: [second.id, first.id], code: "BASELINE_ONLY_ORDER_MISMATCH" },
  ];
  for (const entry of cases)
    assert.throws(
      () => assessWriteRequest({ state: current, onlyIds: entry.onlyIds }),
      (error) => error.code === entry.code,
    );
});

test("migration bloqueada nunca cria cliente de escrita", async () => {
  const blocked = migration("20260101000000_people", {
    physicalState: PHYSICAL_STATES.PARTIAL,
    structuralDrift: true,
  });
  let factories = 0;
  await assert.rejects(
    executeControlledBaseline({
      async stateCollector() {
        return state([blocked]);
      },
      async writeClientFactory() {
        factories += 1;
      },
      context: {},
      onlyIds: [blocked.id],
      confirmationToken: computeBaselineToken("j12", [blocked]),
    }),
    (error) => error.code === "BASELINE_BLOCKED_SELECTION",
  );
  assert.equal(factories, 0);
});

test("mudança entre as duas coletas invalida plano e token antes da escrita", async () => {
  const initial = migration("20260101000000_people");
  const changed = { ...initial, checksum: "b".repeat(64) };
  const collected = [state([initial]), state([changed])];
  let collections = 0;
  let factories = 0;
  await assert.rejects(
    executeControlledBaseline({
      async stateCollector() {
        return collected[collections++];
      },
      async writeClientFactory() {
        factories += 1;
      },
      context: {},
      onlyIds: [initial.id],
      confirmationToken: computeBaselineToken("j12", [initial]),
    }),
    (error) => error.code === "BASELINE_PLAN_CHANGED",
  );
  assert.equal(collections, 2);
  assert.equal(factories, 0);
});

test("repetição idempotente não abre writer nem duplica ledger", async () => {
  const selected = appliedCopy(migration("20260101000000_people"));
  const current = state([selected], { ledgerExists: true });
  let collections = 0;
  let factories = 0;
  const token = computeBaselineToken("j12", [selected]);
  const result = await executeControlledBaseline({
    async stateCollector() {
      collections += 1;
      return current;
    },
    async writeClientFactory() {
      factories += 1;
      throw new Error("idempotent flow must not create writer");
    },
    context: {},
    onlyIds: [selected.id],
    confirmationToken: token,
  });
  assert.equal(collections, 2);
  assert.equal(factories, 0);
  assert.equal(result.writesPerformed, false);
  assert.deepEqual(result.registeredIds, []);
  assert.deepEqual(result.alreadyAppliedIds, [selected.id]);
  assert.equal(result.postValidation.passed, true);
});

test("alteração de schema de domínio após o commit gera erro crítico e fecha writer", async () => {
  const selected = migration("20260101000000_people");
  const before = state([selected], { domainVersion: 1 });
  const afterWithSchemaChange = state([appliedCopy(selected)], {
    domainVersion: 2,
    ledgerExists: true,
  });
  const collected = [before, before, afterWithSchemaChange];
  let collections = 0;
  let closes = 0;
  await assert.rejects(
    executeControlledBaseline({
      async stateCollector() {
        return collected[collections++];
      },
      async writeClientFactory() {
        return {
          writer: {
            async execute() {
              return {
                ledgerCreated: true,
                ddlTransactionSeparated: true,
                recordsBefore: 0,
                recordsAfter: 1,
                insertedIds: [selected.id],
                alreadyAppliedIds: [],
                writesPerformed: true,
              };
            },
          },
          async close() {
            closes += 1;
          },
        };
      },
      context: {},
      onlyIds: [selected.id],
      confirmationToken: computeBaselineToken("j12", [selected]),
    }),
    (error) =>
      error.code === "BASELINE_POST_VALIDATION_FAILED" &&
      error.details.checks.domainSchemaUnchanged === false,
  );
  assert.equal(collections, 3);
  assert.equal(closes, 1);
});
