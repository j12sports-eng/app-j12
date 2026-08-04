"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  assessApplyOneRequest,
  buildApplyOnePlan,
  executeApplyOne,
  isReviewedReconciliationFinding,
} = require("../apply-manager");

const DEPENDENCY_ID = "20260701000000_dependency";
const TARGET_ID = "20260702000000_target";

test("dry-run produz token determinístico, ações, risco e zero escrita", () => {
  const state = createState();
  const first = buildApplyOnePlan(state, TARGET_ID);
  const second = buildApplyOnePlan(state, TARGET_ID);
  assert.equal(first.eligible, true);
  assert.equal(first.writesPerformed, false);
  assert.equal(first.confirmation.expectedToken, second.confirmation.expectedToken);
  assert.match(first.confirmation.expectedToken, /^[a-f0-9]{64}$/u);
  assert.deepEqual(first.migration.dependencies, [DEPENDENCY_ID]);
  assert.equal(first.actions[0].table, "target_table");
  assert.equal(first.risk.ddlImplicitCommit, true);
  assert.equal(first.risk.automaticRollback, false);
});

test("dependência ausente ou ainda não aplicada bloqueia apply-one", () => {
  const missing = createState();
  target(missing).dependencies = ["missing"];
  assert.deepEqual(assessApplyOneRequest(missing, TARGET_ID).reasons, ["DEPENDENCY_MISSING"]);

  const pending = createState();
  dependency(pending).ledgerState = LEDGER_STATES.PENDING;
  dependency(pending).checksumMatches = null;
  assert.ok(assessApplyOneRequest(pending, TARGET_ID).reasons.includes("DEPENDENCY_NOT_APPLIED"));
});

test("migration aplicada, checksum divergente, UNKNOWN e drift estrutural bloqueiam", () => {
  const cases = [
    {
      reason: "MIGRATION_ALREADY_APPLIED",
      mutate(state) {
        target(state).ledgerState = LEDGER_STATES.APPLIED;
      },
    },
    {
      reason: "CHECKSUM_MISMATCH",
      mutate(state) {
        target(state).checksumMatches = false;
      },
    },
    {
      reason: "MIGRATION_UNKNOWN",
      mutate(state) {
        target(state).manifestAvailable = false;
        target(state).physicalState = PHYSICAL_STATES.NOT_ASSESSED;
      },
    },
    {
      reason: "STRUCTURAL_DRIFT",
      mutate(state) {
        target(state).physicalState = PHYSICAL_STATES.PARTIAL;
      },
    },
  ];
  for (const current of cases) {
    const state = createState();
    current.mutate(state);
    assert.ok(
      assessApplyOneRequest(state, TARGET_ID).reasons.includes(current.reason),
      current.reason,
    );
  }
});

test("reconciliação explícita aceita somente estados e achados revisados", () => {
  const state = createState();
  target(state).physicalState = PHYSICAL_STATES.INCOMPATIBLE;
  target(state).applyPolicy = {
    reconciliation: true,
    allowedPhysicalStates: [PHYSICAL_STATES.INCOMPATIBLE],
    reviewedFindingCodes: ["INDEX_MISMATCH"],
  };
  state.doctorReport.findings.push({
    code: "INDEX_MISMATCH",
    details: { migrationId: TARGET_ID },
  });
  assert.equal(assessApplyOneRequest(state, TARGET_ID).eligible, true);
  state.doctorReport.findings.push({
    code: "COLUMN_MISMATCH",
    details: { migrationId: TARGET_ID },
  });
  assert.ok(
    assessApplyOneRequest(state, TARGET_ID).reasons.includes("UNREVIEWED_STRUCTURAL_DRIFT"),
  );
});

test("reconciliação revisa a forma física exata, não apenas o código do achado", () => {
  const policy = {
    reviewedFindingCodes: ["INDEX_MISMATCH", "COLUMN_MISMATCH"],
    reviewedIndexMismatches: [
      {
        table: "enrollments",
        name: "ux_draft",
        unique: true,
        columns: ["person_id", "profile_id"],
      },
    ],
    reviewedColumnMismatches: [
      {
        table: "invitations",
        name: "unit_id",
        columnType: "varchar(64)",
        nullable: false,
      },
    ],
  };
  assert.equal(
    isReviewedReconciliationFinding(policy, {
      code: "INDEX_MISMATCH",
      details: {
        table: "enrollments",
        index: "ux_draft",
        actual: {
          unique: true,
          columns: [{ name: "person_id" }, { name: "profile_id" }],
        },
      },
    }),
    true,
  );
  assert.equal(
    isReviewedReconciliationFinding(policy, {
      code: "INDEX_MISMATCH",
      details: {
        table: "enrollments",
        index: "ux_draft",
        actual: { unique: true, columns: [{ name: "unexpected" }] },
      },
    }),
    false,
  );
  assert.equal(
    isReviewedReconciliationFinding(policy, {
      code: "COLUMN_MISMATCH",
      details: {
        table: "invitations",
        column: "unit_id",
        actual: { columnType: "int", nullable: false },
      },
    }),
    false,
  );
});

test("token inclui banco, checksum, dependências e snapshot completo do plano", () => {
  const original = createState();
  const token = assessApplyOneRequest(original, TARGET_ID).token;
  for (const mutate of [
    (state) => {
      state.doctorReport.database.name = "other";
    },
    (state) => {
      target(state).checksum = "c".repeat(64);
    },
    (state) => {
      dependency(state).checksum = "d".repeat(64);
    },
    (state) => {
      dependency(state).physicalState = PHYSICAL_STATES.PARTIAL;
    },
  ]) {
    const changed = createState();
    mutate(changed);
    assert.notEqual(assessApplyOneRequest(changed, TARGET_ID).token, token);
  }
});

test("token incorreto bloqueia antes de criar writer", async () => {
  let writers = 0;
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => createState(),
        writeClientFactory: async () => {
          writers += 1;
        },
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: "wrong",
        backupIdentifier: "backup-1",
      }),
    (error) => error.code === "APPLY_ONE_CONFIRMATION_MISMATCH",
  );
  assert.equal(writers, 0);
});

test("confirmação de backup ausente bloqueia antes de coleta ou escrita", async () => {
  let collections = 0;
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => {
          collections += 1;
          return createState();
        },
        writeClientFactory: async () => {
          throw new Error("writer não deve ser criado");
        },
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: "token",
      }),
    (error) => error.code === "APPLY_ONE_BACKUP_REQUIRED",
  );
  assert.equal(collections, 0);
});

test("mudança do plano na revalidação imediata bloqueia antes do writer", async () => {
  const initial = createState();
  const changed = createState();
  target(changed).checksum = "e".repeat(64);
  const token = assessApplyOneRequest(initial, TARGET_ID).token;
  let calls = 0;
  let writers = 0;
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => [initial, changed][calls++],
        writeClientFactory: async () => {
          writers += 1;
        },
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: token,
        backupIdentifier: "backup-1",
      }),
    (error) => error.code === "APPLY_ONE_PLAN_CHANGED",
  );
  assert.equal(writers, 0);
});

test("write chama o runner uma vez e exclusivamente para a migration selecionada", async () => {
  const before = createState();
  const after = createState({ applied: true });
  const token = assessApplyOneRequest(before, TARGET_ID).token;
  const states = [before, createState(), after];
  const appliedCalls = [];
  let closed = 0;
  const result = await executeApplyOne({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      runner: {
        async applyOne(id, options) {
          appliedCalls.push({ id, options });
          return { applied: [id] };
        },
      },
      async close() {
        closed += 1;
      },
    }),
    context: {},
    migrationId: TARGET_ID,
    confirmationToken: token,
    backupIdentifier: "dump-20260803-001",
    clock: () => new Date("2026-08-03T12:00:00.000Z"),
  });
  assert.deepEqual(appliedCalls, [{ id: TARGET_ID, options: { dryRun: false } }]);
  assert.equal(closed, 1);
  assert.deepEqual(result.appliedIds, [TARGET_ID]);
  assert.equal(result.postValidation.passed, true);
  assert.equal(result.backupIdentifier, "dump-20260803-001");
});

test("resultado que indica mais de uma migration é rejeitado", async () => {
  const before = createState();
  const token = assessApplyOneRequest(before, TARGET_ID).token;
  const states = [before, createState()];
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => ({
          runner: {
            async applyOne() {
              return { applied: [TARGET_ID, "other"] };
            },
          },
          async close() {},
        }),
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: token,
        backupIdentifier: "backup-1",
      }),
    (error) => error.code === "APPLY_ONE_RUNNER_RESULT_INVALID",
  );
});

test("pós-validação é obrigatória e falha se ledger/schema não convergirem", async () => {
  const before = createState();
  const token = assessApplyOneRequest(before, TARGET_ID).token;
  const states = [before, createState(), createState()];
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => ({
          runner: {
            async applyOne() {
              return { applied: [TARGET_ID] };
            },
          },
          async close() {},
        }),
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: token,
        backupIdentifier: "backup-1",
      }),
    (error) =>
      error.code === "APPLY_ONE_POST_VALIDATION_FAILED" &&
      error.details.checks.selectedApplied === false,
  );
});

test("pós-validação rejeita alteração formal em migration não selecionada", async () => {
  const before = createState();
  const after = createState({ applied: true });
  dependency(after).checksumMatches = false;
  const token = assessApplyOneRequest(before, TARGET_ID).token;
  const states = [before, createState(), after];
  await assert.rejects(
    () =>
      executeApplyOne({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => ({
          runner: {
            async applyOne() {
              return { applied: [TARGET_ID] };
            },
          },
          async close() {},
        }),
        context: {},
        migrationId: TARGET_ID,
        confirmationToken: token,
        backupIdentifier: "backup-1",
      }),
    (error) =>
      error.code === "APPLY_ONE_POST_VALIDATION_FAILED" &&
      error.details.checks.unselectedLedgerUnchanged === false,
  );
});

function createState({ applied = false } = {}) {
  const migrations = [
    {
      id: DEPENDENCY_ID,
      name: "dependency",
      fileName: `${DEPENDENCY_ID}.js`,
      checksum: "a".repeat(64),
      dependencies: [],
      ledgerState: LEDGER_STATES.APPLIED,
      checksumMatches: true,
      physicalState: PHYSICAL_STATES.PRESENT,
      manifestAvailable: true,
      applyPolicy: null,
    },
    {
      id: TARGET_ID,
      name: "target",
      fileName: `${TARGET_ID}.js`,
      checksum: "b".repeat(64),
      dependencies: [DEPENDENCY_ID],
      ledgerState: applied ? LEDGER_STATES.APPLIED : LEDGER_STATES.PENDING,
      checksumMatches: applied ? true : null,
      physicalState: applied ? PHYSICAL_STATES.PRESENT : PHYSICAL_STATES.ABSENT,
      manifestAvailable: true,
      applyPolicy: null,
    },
  ];
  return {
    canonicalPlan: migrations.map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
      state: migration.ledgerState,
    })),
    doctorReport: {
      database: { host: "localhost", name: "j12", remote: false },
      migrations,
      findings: [],
      expectedSchema: [
        {
          migrationId: TARGET_ID,
          requiredTables: ["target_table"],
          requiredColumns: [
            { table: "target_table", name: "id", columnType: "bigint", nullable: false },
          ],
          requiredIndexes: [],
          requiredForeignKeys: [],
          requiredGeneratedColumns: [],
        },
      ],
      schemaSnapshot: {
        tables: {
          unaffected: { columns: { id: { columnType: "bigint" } } },
          j12_alunos: { columns: { id: { columnType: "varchar(64)" } } },
        },
      },
    },
  };
}

function target(state) {
  return state.doctorReport.migrations.find((entry) => entry.id === TARGET_ID);
}

function dependency(state) {
  return state.doctorReport.migrations.find((entry) => entry.id === DEPENDENCY_ID);
}
