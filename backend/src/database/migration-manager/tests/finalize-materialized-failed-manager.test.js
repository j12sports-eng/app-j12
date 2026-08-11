"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { parseArguments } = require("../cli");
const {
  assessMaterializedFinalizeRequest,
  buildFinalizeMaterializedFailedPlan,
  executeMaterializedFinalize,
  getFullMaterializedManifest,
} = require("../finalize-materialized-failed-manager");

const TARGET = "20260724123000_create_user_unit_memberships_table";
const AUTH = "20260724120000_create_auth_identities_table";
const UNIT_FIX = "20260810171000_reconcile_j12_unidades_id_bigint";
const CHECKSUM = "b".repeat(64);
const FAILURE = {
  failedAt: "2026-08-10 20:48:09.758",
  errorMessage: "Unexpected type for user_unit_memberships.unit_id: bigint(20); expected bigint.",
};

function failureFingerprint(record = FAILURE) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        failedAt: record.failedAt || null,
        errorMessage: record.errorMessage || null,
      }),
      "utf8",
    )
    .digest("hex");
}

function manifest() {
  return {
    migrationId: TARGET,
    tables: [
      {
        name: "user_unit_memberships",
        tableArtifact: true,
        engine: "InnoDB",
        charset: "utf8mb4",
        collation: "utf8mb4_unicode_ci",
        columns: { id: { columnType: "varchar(64)", nullable: false } },
        indexes: { PRIMARY: { columns: ["id"], unique: true } },
        foreignKeys: {},
      },
    ],
  };
}

function schema({ present = true } = {}) {
  return {
    tables: present
      ? {
          user_unit_memberships: {
            name: "user_unit_memberships",
            engine: "InnoDB",
            charset: "utf8mb4",
            collation: "utf8mb4_unicode_ci",
            columns: { id: { name: "id", columnType: "varchar(64)", nullable: false } },
            indexes: { PRIMARY: { name: "PRIMARY", unique: true, columns: [{ name: "id" }] } },
            foreignKeys: {},
          },
        }
      : {},
  };
}

function dependency(id, overrides = {}) {
  return {
    id,
    checksum: "a".repeat(64),
    ledgerChecksum: "a".repeat(64),
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    checksumMatches: true,
    appliedAt: "2026-08-10 18:00:00.000",
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.PRESENT,
    structuralDrift: false,
    tableOptionDrift: false,
    ...overrides,
  };
}

function migration(overrides = {}) {
  return {
    id: TARGET,
    timestamp: "20260724123000",
    name: "create_user_unit_memberships_table",
    fileName: `${TARGET}.js`,
    checksum: CHECKSUM,
    ledgerChecksum: CHECKSUM,
    ledgerName: "create_user_unit_memberships_table",
    ledgerTimestamp: "20260724123000",
    dependencies: [AUTH, UNIT_FIX],
    ledgerState: LEDGER_STATES.UNKNOWN,
    ledgerStatus: "FAILED",
    checksumMatches: true,
    appliedAt: null,
    failureEvidenceFingerprint: failureFingerprint(),
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.PRESENT,
    structuralDrift: false,
    tableOptionDrift: false,
    artifactMismatches: [],
    tableOptionDifferences: [],
    requiredArtifactsMissing: [],
    ...overrides,
  };
}

function state(targetOverrides = {}, dependencyOverrides = {}, options = {}) {
  return {
    doctorReport: {
      database: { name: "bestt486_appj12", host: "remote.example", remote: true },
      schemaSnapshot: schema(options),
      migrations: [
        dependency(AUTH, dependencyOverrides),
        dependency(UNIT_FIX, dependencyOverrides),
        migration(targetOverrides),
      ],
    },
  };
}

const testOptions = { manifestResolver: () => manifest() };

function cloneDatabaseRecord(record, { freshDates = false } = {}) {
  return {
    ...record,
    failedAt:
      freshDates && record.failedAt instanceof Date
        ? new Date(record.failedAt.getTime())
        : record.failedAt,
    appliedAt:
      freshDates && record.appliedAt instanceof Date
        ? new Date(record.appliedAt.getTime())
        : record.appliedAt,
    startedAt:
      freshDates && record.startedAt instanceof Date
        ? new Date(record.startedAt.getTime())
        : record.startedAt,
  };
}

function fakeLedger({
  failureRecord = FAILURE,
  rejectUpdate = false,
  freshDates = false,
  recordTransform = null,
} = {}) {
  const status = {
    current: {
      ...failureRecord,
      id: TARGET,
      timestamp: "20260724123000",
      name: "create_user_unit_memberships_table",
      checksum: CHECKSUM,
      status: "FAILED",
      appliedAt: null,
    },
    events: [],
    commits: 0,
    rollbacks: 0,
  };
  return {
    status,
    ledger: {
      async withLock(work) {
        status.events.push("lock");
        return work();
      },
      async withTransaction(work) {
        status.events.push("begin");
        const snapshot = { ...status.current };
        try {
          const result = await work();
          status.commits += 1;
          status.events.push("commit");
          return result;
        } catch (error) {
          status.current = snapshot;
          status.rollbacks += 1;
          status.events.push("rollback");
          throw error;
        }
      },
      async queryReadOnly(sql) {
        assert.match(sql, /^\s*SELECT/u);
        status.events.push("read-only-query");
        return [[], []];
      },
      async readMaterializedFailedRecord() {
        const record = cloneDatabaseRecord(status.current, { freshDates });
        return recordTransform ? recordTransform(record) : record;
      },
      async finalizeMaterializedFailed(selected, { appliedAt, auditEvidence }) {
        status.events.push(`update:${selected.id}`);
        if (rejectUpdate) {
          const error = new Error("affectedRows=0");
          error.code = "MIGRATION_LEDGER_MATERIALIZED_FINALIZE_REJECTED";
          throw error;
        }
        status.current = {
          ...status.current,
          status: "APPLIED",
          appliedAt,
          errorMessage: auditEvidence,
        };
      },
    },
  };
}

test("FAILED materializada com prova estrutural completa é elegível e dry-run não escreve", () => {
  const input = state();
  const before = JSON.stringify(input);
  const assessment = assessMaterializedFinalizeRequest(input, TARGET, testOptions);
  const plan = buildFinalizeMaterializedFailedPlan(input, TARGET, testOptions);

  assert.equal(assessment.eligible, true);
  assert.deepEqual(assessment.reasons, []);
  assert.equal(plan.structuralValidation.expectedArtifacts, 6);
  assert.equal(plan.structuralValidation.foundArtifacts, 6);
  assert.equal(plan.writesPerformed, false);
  assert.equal(JSON.stringify(input), before);
});

test("pós-validação observa a mesma transação e compara failed_at Date semanticamente", async () => {
  const databaseFailure = {
    failedAt: new Date("2026-08-10T20:48:09.758Z"),
    errorMessage: FAILURE.errorMessage,
    startedAt: new Date("2026-08-10T20:48:07.577Z"),
    executionMs: null,
  };
  const before = state({ failureEvidenceFingerprint: failureFingerprint(databaseFailure) });
  const appliedAt = new Date("2026-08-10T22:00:00.123Z");
  const after = state({
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    appliedAt: new Date(appliedAt.getTime()),
  });
  const states = [before, before, before, after];
  const fake = fakeLedger({ failureRecord: databaseFailure, freshDates: true });
  const token = assessMaterializedFinalizeRequest(before, TARGET, testOptions).token;

  const result = await executeMaterializedFinalize({
    stateCollector: async (context) => {
      if (context.reader) await context.reader.query("SELECT 1");
      return states.shift();
    },
    writeClientFactory: async () => ({ ledger: fake.ledger, async close() {} }),
    context: {},
    migrationId: TARGET,
    confirmationToken: token,
    backupIdentifier: "backup-20260810",
    clock: () => appliedAt,
    ...testOptions,
  });
  assert.equal(result.postValidation.passed, true);
  assert.equal(fake.status.rollbacks, 0);
  assert.equal(fake.status.commits, 1);
  assert.equal(fake.status.events.filter((event) => event === "read-only-query").length, 2);
});

test("status, applied_at ou estrutura divergentes na pós-validação causam rollback com reasons", async () => {
  const before = state();
  const token = assessMaterializedFinalizeRequest(before, TARGET, testOptions).token;
  const appliedAt = new Date("2026-08-10T22:00:00.123Z");

  const invalidStatus = fakeLedger();
  const statusStates = [before, before, before, before];
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => statusStates.shift(),
        writeClientFactory: async () => ({ ledger: invalidStatus.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        clock: () => appliedAt,
        ...testOptions,
      }),
    (error) =>
      error.code === "MATERIALIZED_FINALIZE_POST_VALIDATION_FAILED" &&
      error.details.reasons.includes("LEDGER_STATUS_NOT_APPLIED"),
  );
  assert.equal(invalidStatus.status.rollbacks, 1);

  const timestampMismatch = fakeLedger({
    recordTransform(record) {
      if (record.status === "APPLIED") record.appliedAt = new Date(record.appliedAt.getTime() + 1);
      return record;
    },
  });
  const appliedState = state({
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    appliedAt,
  });
  const timestampStates = [before, before, before, appliedState];
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => timestampStates.shift(),
        writeClientFactory: async () => ({ ledger: timestampMismatch.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        clock: () => appliedAt,
        ...testOptions,
      }),
    (error) =>
      error.code === "MATERIALIZED_FINALIZE_POST_VALIDATION_FAILED" &&
      error.details.reasons.includes("APPLIED_AT_MISMATCH"),
  );
  assert.equal(timestampMismatch.status.rollbacks, 1);

  const structuralChange = fakeLedger();
  const structuralAfter = state(
    { ledgerState: LEDGER_STATES.APPLIED, ledgerStatus: "APPLIED", appliedAt },
    {},
    { present: false },
  );
  const structuralStates = [before, before, before, structuralAfter];
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => structuralStates.shift(),
        writeClientFactory: async () => ({ ledger: structuralChange.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        clock: () => appliedAt,
        ...testOptions,
      }),
    (error) =>
      error.code === "MATERIALIZED_FINALIZE_POST_VALIDATION_FAILED" &&
      error.details.reasons.includes("STRUCTURAL_PROOF_INCOMPLETE"),
  );
  assert.equal(structuralChange.status.rollbacks, 1);
});

test("bloqueia status, checksum, applied_at e estados físicos inseguros", () => {
  const cases = [
    { ledgerState: LEDGER_STATES.PENDING, ledgerStatus: null },
    { ledgerState: LEDGER_STATES.APPLIED, ledgerStatus: "APPLIED" },
    { checksumMatches: false },
    { appliedAt: "2026-08-10 21:00:00.000" },
    { physicalState: PHYSICAL_STATES.ABSENT },
    { physicalState: PHYSICAL_STATES.PARTIAL },
    { physicalState: PHYSICAL_STATES.TABLE_OPTION_DRIFT, tableOptionDrift: true },
    { artifactMismatches: [{ code: "INDEX_MISMATCH" }] },
  ];
  for (const overrides of cases)
    assert.equal(
      assessMaterializedFinalizeRequest(state(overrides), TARGET, testOptions).eligible,
      false,
    );
});

test("bloqueia dependência não aplicada e dependente aplicado incompatível", () => {
  const dependencyBlocked = assessMaterializedFinalizeRequest(
    state({}, { ledgerState: LEDGER_STATES.UNKNOWN, ledgerStatus: "FAILED" }),
    TARGET,
    testOptions,
  );
  const dependent = dependency("20260820120000_consumer", {
    dependencies: [TARGET],
    physicalState: PHYSICAL_STATES.PARTIAL,
  });
  const withDependent = state();
  withDependent.doctorReport.migrations.push(dependent);
  const dependentBlocked = assessMaterializedFinalizeRequest(withDependent, TARGET, testOptions);

  assert.ok(dependencyBlocked.reasons.includes("DEPENDENCY_NOT_APPLIED"));
  assert.ok(dependentBlocked.reasons.includes("APPLIED_DEPENDENT_INCOMPATIBLE"));
});

test("WRITE usa lock e transação, altera somente a migration selecionada e preserva a falha", async () => {
  const before = state();
  const appliedAt = new Date("2026-08-10T22:00:00.000Z");
  const after = state({
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    appliedAt,
  });
  const states = [before, before, before, after];
  const fake = fakeLedger();
  const token = assessMaterializedFinalizeRequest(before, TARGET, testOptions).token;
  let closed = 0;

  const result = await executeMaterializedFinalize({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      ledger: fake.ledger,
      async close() {
        closed += 1;
      },
    }),
    context: {},
    migrationId: TARGET,
    confirmationToken: token,
    backupIdentifier: "backup-20260810",
    clock: () => appliedAt,
    ...testOptions,
  });

  assert.equal(result.postValidation.passed, true);
  assert.equal(fake.status.current.status, "APPLIED");
  assert.equal(fake.status.current.failedAt, FAILURE.failedAt);
  assert.match(fake.status.current.errorMessage, /prior_error=Unexpected type/u);
  assert.deepEqual(fake.status.events, ["lock", "begin", `update:${TARGET}`, "commit"]);
  assert.equal(fake.status.rollbacks, 0);
  assert.equal(closed, 1);
});

test("token incorreto, mudança sob lock, update rejeitado e pós-validação falham sem commit", async () => {
  const before = state();
  const token = assessMaterializedFinalizeRequest(before, TARGET, testOptions).token;
  let opened = 0;
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => before,
        writeClientFactory: async () => {
          opened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: "wrong",
        backupIdentifier: "backup",
        ...testOptions,
      }),
    (error) => error.code === "MATERIALIZED_FINALIZE_TOKEN_MISMATCH",
  );
  assert.equal(opened, 0);

  const changed = state({ failureEvidenceFingerprint: "changed" });
  const changedFake = fakeLedger();
  const changedStates = [before, before, changed];
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => changedStates.shift(),
        writeClientFactory: async () => ({ ledger: changedFake.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        ...testOptions,
      }),
    (error) => error.code === "MATERIALIZED_FINALIZE_STATE_CHANGED",
  );
  assert.equal(changedFake.status.rollbacks, 1);

  const rejectedFake = fakeLedger({ rejectUpdate: true });
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => before,
        writeClientFactory: async () => ({ ledger: rejectedFake.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        ...testOptions,
      }),
    (error) => error.code === "MATERIALIZED_FINALIZE_UPDATE_REJECTED",
  );
  assert.equal(rejectedFake.status.rollbacks, 1);

  const postFailureFake = fakeLedger();
  await assert.rejects(
    () =>
      executeMaterializedFinalize({
        stateCollector: async () => [before, before, before, before].shift(),
        writeClientFactory: async () => ({ ledger: postFailureFake.ledger, async close() {} }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup",
        ...testOptions,
      }),
    (error) => error.code === "MATERIALIZED_FINALIZE_POST_VALIDATION_FAILED",
  );
  assert.equal(postFailureFake.status.rollbacks, 1);
});

test("CLI exige token e backup para WRITE e mantém dry-run como padrão", () => {
  assert.equal(
    parseArguments(["finalize-materialized-failed", `--migration=${TARGET}`]).dryRun,
    true,
  );
  assert.throws(
    () => parseArguments(["finalize-materialized-failed", "--write", `--migration=${TARGET}`]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
  assert.throws(
    () =>
      parseArguments([
        "finalize-materialized-failed",
        "--write",
        `--migration=${TARGET}`,
        "--confirm-materialized-finalize=token",
      ]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
});

test("o manifesto completo exige as regras de FK materializadas", () => {
  const full = getFullMaterializedManifest(TARGET);
  const foreignKey = full.tables[0].foreignKeys.fk_user_unit_memberships_auth_identity;
  assert.equal(foreignKey.updateRule, "RESTRICT");
  assert.equal(foreignKey.deleteRule, "RESTRICT");
});
