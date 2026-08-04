"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

const { EXIT_CODES } = require("../../j12-doctor/constants");
const { buildBaselinePlan } = require("../baseline-manager");
const {
  TOKEN_VERSION,
  buildBaselineTokenPayload,
  computeBaselineToken,
} = require("../baseline-token");
const { baselineError } = require("../baseline-errors");
const { main, parseArguments } = require("../cli");
const { formatConsole } = require("../formatter");
const { canonicalPlan, doctorReport } = require("./fixtures");

function outputs() {
  let stdout = "";
  let stderr = "";
  return {
    output: { write: (value) => (stdout += value) },
    errorOutput: { write: (value) => (stderr += value) },
    read: () => ({ stdout, stderr }),
  };
}

function assertUsageWithoutConnection(argv, expectedMessage) {
  return async () => {
    let readClients = 0;
    let writeClients = 0;
    const io = outputs();
    const code = await main(argv, {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        readClients += 1;
        throw new Error("read client must not be created");
      },
      createWriteClient() {
        writeClients += 1;
        throw new Error("write client must not be created");
      },
      ...io,
    });
    assert.equal(code, EXIT_CODES.USAGE);
    assert.equal(readClients, 0);
    assert.equal(writeClients, 0);
    assert.match(io.read().stderr, expectedMessage);
  };
}

test("token usa payload estável com banco, contagem, ordem, IDs e checksums", () => {
  const migrations = [
    { id: "20260101000000_first", checksum: "a".repeat(64) },
    { id: "20260102000000_second", checksum: "b".repeat(64) },
  ];
  const payload = buildBaselineTokenPayload("j12", migrations);
  assert.deepEqual(payload, {
    version: TOKEN_VERSION,
    databaseName: "j12",
    count: 2,
    migrations,
  });
  const expected = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  assert.equal(computeBaselineToken("j12", migrations), expected);
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.notEqual(computeBaselineToken("other", migrations), expected);
  assert.notEqual(computeBaselineToken("j12", [...migrations].reverse()), expected);
  assert.notEqual(
    computeBaselineToken("j12", [{ ...migrations[0], checksum: "c".repeat(64) }, migrations[1]]),
    expected,
  );
});

test("baseline dry-run gera token e lista --only na ordem canônica", () => {
  const report = doctorReport();
  const plan = canonicalPlan(report);
  const result = buildBaselinePlan({ doctorReport: report, canonicalPlan: plan });
  const selected = result.confirmation.only.map((id) =>
    report.migrations.find((migration) => migration.id === id),
  );
  assert.equal(result.mode, "DRY_RUN");
  assert.equal(result.writesPerformed, false);
  assert.deepEqual(
    result.confirmation.only,
    result.registrations.map((registration) => registration.id),
  );
  assert.equal(
    result.confirmation.expectedToken,
    computeBaselineToken(report.database.name, selected),
  );
  const consoleOutput = formatConsole(result);
  assert.match(consoleOutput, /Modo: DRY_RUN/);
  assert.match(consoleOutput, new RegExp(result.confirmation.expectedToken));
  assert.match(consoleOutput, /Lista --only:/);
});

test(
  "CLI bloqueia baseline sem --write ou --dry-run antes de abrir conexão",
  assertUsageWithoutConnection(["baseline", "--confirm-database=j12"], /exatamente um modo/),
);

test(
  "CLI bloqueia baseline --write sem --only antes de abrir conexão",
  assertUsageWithoutConnection(
    ["baseline", "--write", "--confirm-database=j12", "--confirm-baseline=token"],
    /exige --only/,
  ),
);

test(
  "CLI bloqueia baseline --write sem --confirm-baseline antes de abrir conexão",
  assertUsageWithoutConnection(
    ["baseline", "--write", "--confirm-database=j12", "--only=m1"],
    /exige --confirm-baseline/,
  ),
);

test(
  "CLI bloqueia --only sem --write antes de abrir conexão",
  assertUsageWithoutConnection(
    ["baseline", "--dry-run", "--confirm-database=j12", "--only=m1"],
    /--only é aceito apenas/,
  ),
);

test(
  "CLI bloqueia --confirm-baseline sem --write antes de abrir conexão",
  assertUsageWithoutConnection(
    ["baseline", "--dry-run", "--confirm-database=j12", "--confirm-baseline=token"],
    /--confirm-baseline é aceito apenas/,
  ),
);

test(
  "CLI bloqueia --dry-run junto com --write antes de abrir conexão",
  assertUsageWithoutConnection(
    [
      "baseline",
      "--dry-run",
      "--write",
      "--confirm-database=j12",
      "--only=m1",
      "--confirm-baseline=token",
    ],
    /exatamente um modo/,
  ),
);

test("parser normaliza espaços da lista --only no modo write válido", () => {
  const options = parseArguments([
    "baseline",
    "--write",
    "--confirm-database=j12",
    "--only=m1, m2",
    "--confirm-baseline=token",
  ]);
  assert.equal(options.write, true);
  assert.deepEqual(options.onlyIds, ["m1", "m2"]);
  assert.equal(options.confirmBaseline, "token");
});

test("CLI dry-run usa somente o cliente de leitura fake e nunca cria writer", async () => {
  let readClients = 0;
  let readClosed = 0;
  let writeClients = 0;
  let managerWrites = 0;
  const io = outputs();
  const report = doctorReport();
  const result = buildBaselinePlan({
    doctorReport: report,
    canonicalPlan: canonicalPlan(report),
  });
  result.doctorSummary = { severityCounts: { CRITICAL: 0, HIGH: 0, WARNING: 0 } };
  const code = await main(["baseline", "--dry-run", "--confirm-database=j12", "--format=json"], {
    env: { DB_HOST: "localhost", DB_NAME: "j12" },
    createClient() {
      readClients += 1;
      return {
        async close() {
          readClosed += 1;
        },
      };
    },
    createWriteClient() {
      writeClients += 1;
      throw new Error("dry-run must not create a write client");
    },
    manager: {
      async run(command) {
        assert.equal(command, "baseline");
        return result;
      },
      async runBaselineWrite() {
        managerWrites += 1;
        throw new Error("dry-run must not enter write flow");
      },
    },
    ...io,
  });
  assert.equal(code, EXIT_CODES.CLEAN);
  assert.equal(readClients, 1);
  assert.equal(readClosed, 1);
  assert.equal(writeClients, 0);
  assert.equal(managerWrites, 0);
  assert.equal(JSON.parse(io.read().stdout).writesPerformed, false);
});

test("CLI integra baseline write com IDs e token explícitos usando somente fakes", async () => {
  let readClosed = 0;
  let managerRuns = 0;
  let managerWriteRuns = 0;
  let writeFactoryCalls = 0;
  const io = outputs();
  const code = await main(
    [
      "baseline",
      "--write",
      "--confirm-database=j12",
      "--only=m1,m2",
      "--confirm-baseline=confirmed-token",
      "--format=json",
    ],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        return {
          async close() {
            readClosed += 1;
          },
        };
      },
      createWriteClient() {
        writeFactoryCalls += 1;
        return { fake: true };
      },
      manager: {
        async run() {
          managerRuns += 1;
        },
        async runBaselineWrite(context) {
          managerWriteRuns += 1;
          assert.deepEqual(context.onlyIds, ["m1", "m2"]);
          assert.equal(context.confirmationToken, "confirmed-token");
          assert.deepEqual(context.writeClientFactory(), { fake: true });
          return {
            command: "baseline",
            mode: "WRITE",
            database: { host: "localhost", name: "j12", remote: false },
            registeredIds: ["m1", "m2"],
            alreadyAppliedIds: [],
            checksums: [],
            ledgerCreated: false,
            ddlTransactionSeparated: false,
            recordsBefore: 0,
            recordsAfter: 2,
            tokenConfirmed: "confirmed-token",
            writesPerformed: true,
            timestamp: "2026-08-03T12:00:00.000Z",
            postValidation: { passed: true, checks: {} },
          };
        },
      },
      ...io,
    },
  );
  assert.equal(code, EXIT_CODES.CLEAN);
  assert.equal(managerRuns, 0);
  assert.equal(managerWriteRuns, 1);
  assert.equal(writeFactoryCalls, 1);
  assert.equal(readClosed, 1);
  assert.equal(JSON.parse(io.read().stdout).mode, "WRITE");
});

test("erro controlado de token retorna CRITICAL e fecha o reader fake", async () => {
  let closed = 0;
  let writeClients = 0;
  const io = outputs();
  const code = await main(
    ["baseline", "--write", "--confirm-database=j12", "--only=m1", "--confirm-baseline=invalid"],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        return {
          async close() {
            closed += 1;
          },
        };
      },
      createWriteClient() {
        writeClients += 1;
      },
      manager: {
        async runBaselineWrite() {
          throw baselineError("token inválido", "BASELINE_CONFIRMATION_MISMATCH");
        },
      },
      ...io,
    },
  );
  assert.equal(code, EXIT_CODES.CRITICAL);
  assert.equal(closed, 1);
  assert.equal(writeClients, 0);
  assert.match(io.read().stderr, /BASELINE_CONFIRMATION_MISMATCH/);
});

test("formatter exibe auditoria completa do baseline write sem credenciais", () => {
  const output = formatConsole({
    command: "baseline",
    mode: "WRITE",
    database: { host: "localhost", name: "j12", remote: false },
    registeredIds: ["m1"],
    alreadyAppliedIds: ["m0"],
    ledgerCreated: true,
    recordsBefore: 1,
    recordsAfter: 2,
    tokenConfirmed: "confirmed-token",
    writesPerformed: true,
    timestamp: "2026-08-03T12:00:00.000Z",
    postValidation: { passed: true },
  });
  assert.match(output, /baseline controlado/);
  assert.match(output, /Ledger criado: sim/);
  assert.match(output, /Registros antes\/depois: 1\/2/);
  assert.match(output, /Validação posterior: aprovada/);
  assert.match(output, /Migrations registradas:\nm1|Migrations registradas:\n  m1/);
  assert.match(output, /Migrations já aplicadas:/);
  assert.doesNotMatch(output, /password|senha|DB_PASSWORD/i);
});
