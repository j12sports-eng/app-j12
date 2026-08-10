"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  assessRetryFailedRequest,
  buildRetryFailedPlan,
  computeRetryFailedToken,
  executeRetryFailed,
} = require("../retry-failed-manager");
const { parseArguments } = require("../cli");

const TARGET = "20260724123000_create_user_unit_memberships_table";

const AUTH = "20260724120000_create_auth_identities_table";

const UNIT_FIX = "20260810171000_reconcile_j12_unidades_id_bigint";

function migration(overrides = {}) {
  return {
    id: TARGET,
    fileName: `${TARGET}.js`,
    checksum: "b".repeat(64),
    dependencies: [AUTH, UNIT_FIX],
    ledgerState: LEDGER_STATES.UNKNOWN,
    ledgerStatus: "FAILED",
    checksumMatches: true,
    appliedAt: null,
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.ABSENT,
    ...overrides,
  };
}

function dependency(id, overrides = {}) {
  return {
    id,
    checksum: "a".repeat(64),
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    checksumMatches: true,
    appliedAt: "2026-08-10T12:00:00.000Z",
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.PRESENT,
    ...overrides,
  };
}

function state(targetOverrides = {}, dependencyOverrides = {}) {
  return {
    doctorReport: {
      database: {
        name: "bestt486_appj12",
        host: "108.167.168.27",
      },
      migrations: [
        dependency(AUTH, dependencyOverrides),
        dependency(UNIT_FIX, dependencyOverrides),
        migration(targetOverrides),
      ],
    },
  };
}

test("retry-failed fica elegivel somente para FAILED fisicamente ausente", () => {
  const result = assessRetryFailedRequest(state(), TARGET);

  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.migration.ledgerStatus, "FAILED");
  assert.equal(result.migration.checksumMatches, true);
  assert.equal(result.migration.physicalState, PHYSICAL_STATES.ABSENT);
});

test("retry-failed aceita FAILED totalmente ausente mesmo quando o Doctor reporta artefato esperado faltante", () => {
  const result = assessRetryFailedRequest(
    state({
      structuralDrift: true,
      tableOptionDrift: false,
      requiredArtifactsMissing: [{ code: "TABLE_MISSING", table: "user_unit_memberships" }],
      artifactMismatches: [],
    }),
    TARGET,
  );

  assert.equal(result.eligible, true);
  assert.ok(!result.reasons.includes("PHYSICAL_STATE_UNSAFE"));
});

test("retry-failed continua bloqueando evidência independente de artefato incompatível", () => {
  const result = assessRetryFailedRequest(
    state({
      structuralDrift: true,
      artifactMismatches: [{ code: "INDEX_MISMATCH", index: "unexpected_partial_artifact" }],
    }),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("PHYSICAL_STATE_UNSAFE"));
});

test("retry-failed gera plano somente leitura com token deterministico", () => {
  const input = state();

  const first = buildRetryFailedPlan(input, TARGET);
  const second = buildRetryFailedPlan(input, TARGET);

  assert.equal(first.command, "retry-failed");
  assert.equal(first.mode, "DRY_RUN");
  assert.equal(first.dryRun, true);
  assert.equal(first.writesPerformed, false);
  assert.equal(first.eligible, true);
  assert.equal(first.confirmation.expectedToken.length, 64);
  assert.equal(first.confirmation.expectedToken, second.confirmation.expectedToken);

  assert.equal(
    first.confirmation.expectedToken,
    computeRetryFailedToken({
      databaseName: input.doctorReport.database.name,
      migration: input.doctorReport.migrations[2],
      dependencies: input.doctorReport.migrations.slice(0, 2),
    }),
  );
});

test("retry-failed bloqueia status diferente de FAILED", () => {
  const result = assessRetryFailedRequest(
    state({
      ledgerStatus: "APPLYING",
    }),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("LEDGER_STATUS_NOT_FAILED"));
});

test("retry-failed bloqueia checksum divergente", () => {
  const result = assessRetryFailedRequest(
    state({
      checksumMatches: false,
    }),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("CHECKSUM_NOT_CONFIRMED"));
});

test("retry-failed bloqueia migration que possui applied_at", () => {
  const result = assessRetryFailedRequest(
    state({
      appliedAt: "2026-08-10T13:00:00.000Z",
    }),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("MIGRATION_HAS_APPLIED_AT"));
});

test("retry-failed bloqueia estado fisico diferente de ausente", () => {
  const result = assessRetryFailedRequest(
    state({
      physicalState: PHYSICAL_STATES.PRESENT,
    }),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("PHYSICAL_STATE_NOT_ABSENT"));
});

test("retry-failed bloqueia dependencia ainda nao aplicada", () => {
  const result = assessRetryFailedRequest(
    state(
      {},
      {
        ledgerState: LEDGER_STATES.PENDING,
        ledgerStatus: null,
        checksumMatches: null,
        appliedAt: null,
      },
    ),
    TARGET,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("DEPENDENCY_NOT_APPLIED"));
});

test("retry-failed exige migration existente no catalogo observado", () => {
  assert.throws(
    () => assessRetryFailedRequest(state(), "20990101000000_missing"),
    (error) => error.code === "RETRY_FAILED_MIGRATION_NOT_FOUND",
  );
});

test("retry-failed bloqueia manifest ou dependência fisicamente inseguros", () => {
  const missingManifest = assessRetryFailedRequest(state({ manifestAvailable: false }), TARGET);
  const unsafeDependency = assessRetryFailedRequest(
    state({}, { physicalState: PHYSICAL_STATES.PARTIAL }),
    TARGET,
  );

  assert.ok(missingManifest.reasons.includes("MIGRATION_MANIFEST_UNAVAILABLE"));
  assert.ok(unsafeDependency.reasons.includes("DEPENDENCY_PHYSICAL_STATE_UNSAFE"));
});

test("retry-failed CLI é dry-run por padrão e WRITE exige confirmação própria", () => {
  const dryRun = parseArguments(["retry-failed", `--migration=${TARGET}`]);

  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.write, false);
  assert.throws(
    () => parseArguments(["retry-failed", "--write", `--migration=${TARGET}`]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
  assert.throws(
    () =>
      parseArguments(["retry-failed", "--write", `--migration=${TARGET}`, "--confirm-retry=token"]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
  assert.throws(
    () =>
      parseArguments([
        "retry-failed",
        "--write",
        `--migration=${TARGET}`,
        "--confirm-retry=token",
        "--confirm-backup=backup-20260810",
        "--confirm-apply=wrong-command-token",
      ]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
  assert.equal(
    parseArguments([
      "retry-failed",
      "--write",
      `--migration=${TARGET}`,
      "--confirm-retry=token",
      "--confirm-backup=backup-20260810",
    ]).write,
    true,
  );
});

test("retry-failed WRITE revalida e aceita somente a migration selecionada", async () => {
  const before = state();
  const after = state({
    appliedAt: "2026-08-10T18:40:00.000Z",
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    physicalState: PHYSICAL_STATES.PRESENT,
  });
  const token = assessRetryFailedRequest(before, TARGET).token;
  const states = [before, before, after];
  const calls = [];

  const result = await executeRetryFailed({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      runner: {
        async retryFailed(id) {
          calls.push(id);
          return { applied: [id] };
        },
      },
      async close() {},
    }),
    context: {},
    migrationId: TARGET,
    confirmationToken: token,
    backupIdentifier: "backup-20260810",
    clock: () => new Date("2026-08-10T18:41:00.000Z"),
  });

  assert.deepEqual(calls, [TARGET]);
  assert.deepEqual(result.appliedIds, [TARGET]);
  assert.equal(result.postValidation.passed, true);
});
