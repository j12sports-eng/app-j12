"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { EXIT_CODES } = require("../../j12-doctor/constants");
const { ControlledApplyOneError } = require("../apply-one-errors");
const { main, parseArguments } = require("../cli");
const { formatConsole } = require("../formatter");

const MIGRATION_ID = "20260803123000_reconcile_enrollment_multiunit_invariants";

test("parser aceita apply-one dry-run e exige todas as confirmações no write", () => {
  const dryRun = parseArguments([
    "apply-one",
    "--dry-run",
    `--migration=${MIGRATION_ID}`,
    "--confirm-database=j12",
  ]);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.migrationId, MIGRATION_ID);

  assert.throws(
    () =>
      parseArguments([
        "apply-one",
        "--write",
        `--migration=${MIGRATION_ID}`,
        "--confirm-database=j12",
        "--confirm-backup=dump-1",
      ]),
    /--confirm-apply/u,
  );
  assert.throws(
    () =>
      parseArguments([
        "apply-one",
        "--write",
        `--migration=${MIGRATION_ID}`,
        "--confirm-database=j12",
        "--confirm-apply=token",
      ]),
    /--confirm-backup/u,
  );
  assert.throws(
    () =>
      parseArguments([
        "apply-one",
        "--dry-run",
        `--migration=${MIGRATION_ID}`,
        "--confirm-database=j12",
        "--confirm-apply=token",
      ]),
    /apenas com apply-one --write/u,
  );
});

test("CLI dry-run usa somente reader fake e não cria cliente de write", async () => {
  let readers = 0;
  let writers = 0;
  let closed = 0;
  const io = outputs();
  const result = dryRunResult();
  const code = await main(
    [
      "apply-one",
      "--dry-run",
      `--migration=${MIGRATION_ID}`,
      "--confirm-database=j12",
      "--format=json",
    ],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        readers += 1;
        return {
          async close() {
            closed += 1;
          },
        };
      },
      createApplyClient() {
        writers += 1;
      },
      manager: {
        async run(command, context) {
          assert.equal(command, "apply-one");
          assert.equal(context.migrationId, MIGRATION_ID);
          return result;
        },
      },
      ...io,
    },
  );
  assert.equal(code, EXIT_CODES.CLEAN);
  assert.equal(readers, 1);
  assert.equal(writers, 0);
  assert.equal(closed, 1);
  assert.equal(JSON.parse(io.read().stdout).writesPerformed, false);
});

test("CLI write encaminha migration, token e backup explícitos usando somente fakes", async () => {
  const io = outputs();
  let writerCreated = 0;
  let readerClosed = 0;
  const code = await main(
    [
      "apply-one",
      "--write",
      `--migration=${MIGRATION_ID}`,
      "--confirm-database=j12",
      "--confirm-apply=token-1",
      "--confirm-backup=dump-1",
      "--format=json",
    ],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        return {
          async close() {
            readerClosed += 1;
          },
        };
      },
      createApplyClient() {
        writerCreated += 1;
        return { fake: true };
      },
      manager: {
        async runApplyOneWrite(context) {
          assert.equal(context.migrationId, MIGRATION_ID);
          assert.equal(context.confirmationToken, "token-1");
          assert.equal(context.backupIdentifier, "dump-1");
          assert.deepEqual(context.writeClientFactory(), { fake: true });
          return writeResult();
        },
      },
      ...io,
    },
  );
  assert.equal(code, EXIT_CODES.CLEAN);
  assert.equal(writerCreated, 1);
  assert.equal(readerClosed, 1);
  assert.equal(JSON.parse(io.read().stdout).migrationId, MIGRATION_ID);
});

test("erro controlado de apply-one retorna CRITICAL e fecha o reader fake", async () => {
  const io = outputs();
  let closed = 0;
  const code = await main(
    [
      "apply-one",
      "--write",
      `--migration=${MIGRATION_ID}`,
      "--confirm-database=j12",
      "--confirm-apply=bad",
      "--confirm-backup=dump-1",
    ],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        return {
          async close() {
            closed += 1;
          },
        };
      },
      manager: {
        async runApplyOneWrite() {
          throw new ControlledApplyOneError("token inválido", "APPLY_ONE_CONFIRMATION_MISMATCH");
        },
      },
      ...io,
    },
  );
  assert.equal(code, EXIT_CODES.CRITICAL);
  assert.equal(closed, 1);
  assert.match(io.read().stderr, /APPLY_ONE_CONFIRMATION_MISMATCH/u);
});

test("formatter expõe plano, risco, elegibilidade, ações e token", () => {
  const output = formatConsole(dryRunResult());
  assert.match(output, new RegExp(MIGRATION_ID));
  assert.match(output, /Ledger: LEDGER_PENDING/u);
  assert.match(output, /Estado físico: PARTIALLY_PRESENT/u);
  assert.match(output, /Elegível: sim/u);
  assert.match(output, /DDL implícito: sim/u);
  assert.match(output, /Token esperado: [a-f0-9]{64}/u);
  assert.match(output, /INDEX enrollments\.ux_current/u);
});

function dryRunResult() {
  return {
    command: "apply-one",
    mode: "DRY_RUN",
    writesPerformed: false,
    eligible: true,
    valid: true,
    reasons: [],
    database: { host: "localhost", name: "j12", remote: false },
    migration: {
      id: MIGRATION_ID,
      checksum: "a".repeat(64),
      dependencies: ["dependency"],
      ledgerState: "LEDGER_PENDING",
      physicalState: "PARTIALLY_PRESENT",
    },
    actions: [
      { kind: "INDEX", table: "enrollments", name: "ux_current", action: "ADD_OR_VALIDATE" },
    ],
    risk: { level: "HIGH", ddlImplicitCommit: true, automaticRollback: false },
    confirmation: { expectedToken: "b".repeat(64) },
    doctorSummary: { severityCounts: {} },
  };
}

function writeResult() {
  return {
    command: "apply-one",
    mode: "WRITE",
    database: { host: "localhost", name: "j12", remote: false },
    migrationId: MIGRATION_ID,
    checksum: "a".repeat(64),
    backupIdentifier: "dump-1",
    tokenConfirmed: "token-1",
    postValidation: { passed: true },
    timestamp: "2026-08-03T12:00:00.000Z",
  };
}

function outputs() {
  let stdout = "";
  let stderr = "";
  return {
    output: {
      write(value) {
        stdout += value;
      },
    },
    errorOutput: {
      write(value) {
        stderr += value;
      },
    },
    read: () => ({ stdout, stderr }),
  };
}
