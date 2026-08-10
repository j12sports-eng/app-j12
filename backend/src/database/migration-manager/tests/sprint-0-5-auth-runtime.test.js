"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { assessManifest } = require("../../j12-doctor/checks/schema-manifest-check");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  authRuntimeBaselineAdoption,
} = require("../baseline-adoptions/auth-runtime.adoption");

const { createAuthRuntimeRealSchemaFixture } = require("./auth-runtime-real.fixture");

const { evaluateBaselineEligibility } = require("../baseline-eligibility-policy");
const {
  assessApplyOneRequest,
  buildApplyOnePlan,
  executeApplyOne,
  validateApplyOnePostState,
} = require("../apply-manager");
const { main, parseArguments } = require("../cli");
const { formatConsole } = require("../formatter");
const {
  EXPECTED_TEXT_COLUMNS,
  TABLES,
  collectAuthRuntimePreflight,
  createAuthRuntimeCharsetCollationReconciliation,
} = require("../../migrations/20260803133000_reconcile_auth_runtime_charset_collation");

test("1. somente charset diferente gera TABLE_OPTION_DRIFT", () => {
  const { schema, manifest } = optionFixture();
  schema.tables.sample.charset = "utf8";
  assertOptionOnly(assessManifest(schema, manifest), "charset");
});

test("2. somente collation diferente gera TABLE_OPTION_DRIFT", () => {
  const { schema, manifest } = optionFixture();
  schema.tables.sample.collation = "utf8_unicode_ci";
  assertOptionOnly(assessManifest(schema, manifest), "collation");
});

test("3. coluna ausente continua STRUCTURAL_DRIFT", () => {
  const { schema, manifest } = optionFixture();
  delete schema.tables.sample.columns.id;
  const result = assessManifest(schema, manifest);
  assert.equal(result.physicalState, PHYSICAL_STATES.PARTIAL);
  assert.equal(result.structuralDrift, true);
  assert.equal(result.tableOptionDrift, false);
});

test("4. índice incompatível continua STRUCTURAL_DRIFT", () => {
  const { schema, manifest } = optionFixture();
  schema.tables.sample.indexes.PRIMARY.unique = false;
  const result = assessManifest(schema, manifest);
  assert.equal(result.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.equal(result.structuralDrift, true);
});

test("5. TABLE_OPTION_DRIFT bloqueia baseline por padrão", () => {
  const result = evaluateBaselineEligibility({
    migration: baselineMigration({ id: "20260101000000_other" }),
    findings: [optionFinding("20260101000000_other")],
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_RECONCILIATION_REQUIRED"));
});

test("6. exceção auditada permite apenas a migration específica", () => {
  const historical = baselineMigration();
  const result = evaluateBaselineEligibility({
    migration: historical,
    findings: optionFindings(historical.id),
    catalogMigrations: [historical, correctiveCatalogEntry()],
    schemaSnapshot: createAuthRuntimeRealSchemaFixture(),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.tableOptionDecision, "LEGACY_AUTH_STRUCTURE_ACCEPTED");
  assert.equal(
    result.tableOptionAdoption.migrationChecksum,
    authRuntimeBaselineAdoption.migrationChecksum,
  );
});

test("7. exceção não permite outras migrations", () => {
  const other = baselineMigration({
    id: "20260101000000_unreviewed",
    checksum: authRuntimeBaselineAdoption.migrationChecksum,
  });

  const result = evaluateBaselineEligibility({
    migration: other,
    findings: optionFindings(other.id),
    catalogMigrations: [other, correctiveCatalogEntry()],
    schemaSnapshot: createAuthRuntimeRealSchemaFixture(),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.tableOptionAdoption, null);
});

test("8. exceção exige migration corretiva vinculada", () => {
  const historical = baselineMigration();
  const result = evaluateBaselineEligibility({
    migration: historical,
    findings: optionFindings(historical.id),
    catalogMigrations: [historical],
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED"));
});

function optionFixture() {
  return {
    manifest: {
      id: "m1",
      tables: [
        {
          name: "sample",
          engine: "InnoDB",
          charset: "utf8mb4",
          collation: "utf8mb4_unicode_ci",
          columns: { id: { columnType: "varchar(64)", nullable: false } },
          indexes: { PRIMARY: { columns: ["id"], unique: true } },
          foreignKeys: {},
        },
      ],
    },
    schema: {
      tables: {
        sample: {
          engine: "InnoDB",
          charset: "utf8mb4",
          collation: "utf8mb4_unicode_ci",
          columns: { id: { columnType: "varchar(64)", nullable: false } },
          indexes: { PRIMARY: { columns: [{ name: "id" }], unique: true } },
          foreignKeys: {},
        },
      },
    },
  };
}

function assertOptionOnly(result, property) {
  assert.equal(result.physicalState, PHYSICAL_STATES.TABLE_OPTION_DRIFT);
  assert.equal(result.structuralDrift, false);
  assert.equal(result.tableOptionDrift, true);
  assert.deepEqual(
    result.findings
      .filter((item) => item.code === "TABLE_OPTION_MISMATCH")
      .map((item) => item.details.property),
    [property],
  );
}

function baselineMigration(overrides = {}) {
  return {
    id: AUTH_RUNTIME_HISTORICAL_MIGRATION,
    checksum: authRuntimeBaselineAdoption.migrationChecksum,
    checksumMatches: null,
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    physicalState: PHYSICAL_STATES.TABLE_OPTION_DRIFT,
    tableOptionDrift: true,
    manifestAvailable: true,
    ...overrides,
  };
}

function optionFinding(migrationId) {
  return {
    code: "TABLE_OPTION_MISMATCH",
    details: {
      migrationId,
      table: "users",
      property: "charset",
      actual: "utf8",
      expected: "utf8mb4",
    },
  };
}

function optionFindings(migrationId) {
  return authRuntimeBaselineAdoption.acceptedTemporaryTableOptionDifferences.map((difference) => ({
    code: "TABLE_OPTION_MISMATCH",
    details: { migrationId, ...difference },
  }));
}

function correctiveCatalogEntry() {
  return {
    id: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    dependencies: [AUTH_RUNTIME_HISTORICAL_MIGRATION],
    manifestAvailable: true,
  };
}

test("9. migration corretiva é idempotente", async () => {
  const fake = authMetadataFake({ charset: "utf8mb4", collation: "utf8mb4_unicode_ci" });
  const migration = createAuthRuntimeCharsetCollationReconciliation({
    queryRunner: fake.query,
    tableExists: fake.tableExists,
  });
  const first = await migration.up();
  const second = await migration.up();
  assert.deepEqual(first.changedTables, []);
  assert.deepEqual(second.changedTables, []);
  assert.equal(fake.alters.length, 0);
});

test("10. schema já utf8mb4 não gera ALTER", async () => {
  const fake = authMetadataFake({ charset: "utf8mb4", collation: "utf8mb4_unicode_ci" });
  const result = await collectAuthRuntimePreflight({ queryRunner: fake.query });
  assert.equal(result.safeToApply, true);
  assert.ok(result.tables.every((table) => table.requiresChange === false));
  assert.equal(fake.alters.length, 0);
});

test("11. schema utf8 gera plano de conversão", async () => {
  const result = await collectAuthRuntimePreflight({
    queryRunner: authMetadataFake().query,
  });
  assert.equal(result.safeToApply, true);
  assert.deepEqual(
    result.tables.filter((table) => table.requiresChange).map((table) => table.name),
    TABLES,
  );
  assert.equal(result.target.charset, "utf8mb4");
});

test("12. tabela ausente bloqueia", async () => {
  const result = await collectAuthRuntimePreflight({
    queryRunner: authMetadataFake({ missingTable: "user_sessions" }).query,
  });
  assert.equal(result.safeToApply, false);
  assert.ok(result.blockers.some((item) => item.code === "TABLE_MISSING"));
});

test("13. engine incompatível bloqueia", async () => {
  const result = await collectAuthRuntimePreflight({
    queryRunner: authMetadataFake({ engine: "MyISAM" }).query,
  });
  assert.equal(result.safeToApply, false);
  assert.ok(result.blockers.some((item) => item.code === "ENGINE_UNSAFE"));
});

test("14. dados ou índices incompatíveis bloqueiam", async () => {
  const encoding = await collectAuthRuntimePreflight({
    queryRunner: authMetadataFake({
      charset: "latin1",
      collation: "latin1_swedish_ci",
    }).query,
  });
  const index = await collectAuthRuntimePreflight({
    queryRunner: authMetadataFake({ overflowIndex: true }).query,
  });
  assert.ok(encoding.blockers.some((item) => item.code === "CHARSET_UNSUPPORTED"));
  assert.ok(index.blockers.some((item) => item.code === "UTF8MB4_INDEX_SIZE_UNSAFE"));
});

test("15. dry-run não escreve", () => {
  const plan = buildApplyOnePlan(authApplyState(), AUTH_RUNTIME_CORRECTIVE_MIGRATION);
  assert.equal(plan.writesPerformed, false);
  assert.equal(plan.eligible, true);
  assert.equal(plan.operationalPreflight.readOnly, true);
  assert.match(plan.confirmation.expectedToken, /^[a-f0-9]{64}$/u);
  assert.throws(
    () =>
      parseArguments([
        "apply-one",
        "--write",
        `--migration=${AUTH_RUNTIME_CORRECTIVE_MIGRATION}`,
        "--confirm-database=j12",
        "--confirm-backup=dump-1",
        "--confirm-apply=token",
      ]),
    /--confirm-tables/u,
  );
  assert.throws(
    () =>
      parseArguments([
        "apply-one",
        "--write",
        `--migration=${AUTH_RUNTIME_CORRECTIVE_MIGRATION}`,
        "--confirm-database=j12",
        "--confirm-backup=dump-1",
        "--confirm-apply=token",
        "--confirm-tables=users,user_sessions,j12_usuarios",
      ]),
    /corresponder exatamente/u,
  );
  const write = parseArguments([
    "apply-one",
    "--write",
    `--migration=${AUTH_RUNTIME_CORRECTIVE_MIGRATION}`,
    "--confirm-database=j12",
    "--allow-remote",
    "--confirm-backup=dump-1",
    "--confirm-apply=token",
    "--confirm-tables=users,user_sessions,password_reset_tokens",
  ]);
  assert.deepEqual(write.confirmedTables, TABLES);
  assert.equal(write.allowRemote, true);
});

test("16. nenhuma senha, hash ou token é lida ou impressa", async () => {
  const fake = authMetadataFake();
  const preflight = await collectAuthRuntimePreflight({ queryRunner: fake.query });
  const operationalReads = fake.sql.filter((sql) => /FROM `/iu.test(sql)).join("\n");
  assert.doesNotMatch(operationalReads, /CHAR_LENGTH\(`(?:password_hash|password_salt|token)`\)/iu);
  const output = formatConsole({
    ...buildApplyOnePlan(authApplyState({ preflight }), AUTH_RUNTIME_CORRECTIVE_MIGRATION),
    doctorSummary: { severityCounts: {} },
  });
  assert.doesNotMatch(output, /password_hash|password_salt|conteúdo sensível/iu);
});

function authMetadataFake({
  charset = "utf8",
  collation = "utf8_unicode_ci",
  engine = "InnoDB",
  missingTable = null,
  overflowIndex = false,
} = {}) {
  const options = Object.fromEntries(TABLES.map((table) => [table, { charset, collation }]));
  const sql = [];
  const alters = [];

  async function query(statement) {
    sql.push(statement);
    if (/^ALTER TABLE/iu.test(statement)) {
      alters.push(statement);
      const table = /ALTER TABLE `([^`]+)`/iu.exec(statement)[1];
      options[table] = { charset: "utf8mb4", collation: "utf8mb4_unicode_ci" };
      return [];
    }
    if (/SELECT VERSION\(\)/iu.test(statement))
      return [{ version: "8.0.36", sql_mode: "STRICT_TRANS_TABLES" }];
    if (/FROM information_schema\.tables/iu.test(statement))
      return TABLES.filter((table) => table !== missingTable).map((table) => ({
        TABLE_NAME: table,
        ENGINE: engine,
        TABLE_COLLATION: options[table].collation,
        ROW_FORMAT: "Compact",
        TABLE_ROWS: 50,
        DATA_LENGTH: 16384,
        INDEX_LENGTH: 16384,
        DATA_FREE: 0,
      }));
    if (/FROM information_schema\.columns/iu.test(statement))
      return TABLES.filter((table) => table !== missingTable).flatMap((table) =>
        Object.entries(EXPECTED_TEXT_COLUMNS[table]).map(
          ([column, [columnType, nullable]], ordinal) => ({
            TABLE_NAME: table,
            COLUMN_NAME: column,
            COLUMN_TYPE: columnType,
            IS_NULLABLE: nullable ? "YES" : "NO",
            CHARACTER_SET_NAME: options[table].charset,
            COLLATION_NAME: options[table].collation,
            CHARACTER_MAXIMUM_LENGTH: declaredLength(columnType),
            ORDINAL_POSITION: ordinal + 1,
          }),
        ),
      );
    if (/FROM information_schema\.statistics/iu.test(statement)) {
      const rows = [
        indexRow("users", "PRIMARY", "id"),
        indexRow("users", "uniq_users_email", "email"),
        indexRow("users", "uniq_users_login", "login"),
        indexRow("users", "idx_users_role", "role", 1),
        indexRow("users", "idx_users_aluno", "aluno_id", 1),
        indexRow("users", "idx_users_professor", "professor_id", 1),
        indexRow("users", "idx_users_responsavel", "responsavel_id", 1),
        indexRow("user_sessions", "PRIMARY", "token"),
        indexRow("user_sessions", "idx_sessions_user", "user_id", 1),
        indexRow("user_sessions", "idx_sessions_expires", "expires_at", 1),
        indexRow("password_reset_tokens", "PRIMARY", "token"),
        indexRow("password_reset_tokens", "idx_password_reset_user", "user_id", 1),
        indexRow("password_reset_tokens", "idx_password_reset_expires", "expires_at", 1),
      ];
      if (overflowIndex) rows.push(indexRow("users", "idx_unsafe_hash", "password_hash"));
      return rows.filter((row) => row.TABLE_NAME !== missingTable);
    }
    if (/FROM information_schema\.key_column_usage/iu.test(statement)) return [];
    if (/^SELECT MAX\(CHAR_LENGTH/iu.test(statement)) return [{}];
    throw new Error(`Unexpected fake SQL: ${statement}`);
  }

  return {
    alters,
    sql,
    query,
    async tableExists(table) {
      return table !== missingTable;
    },
  };
}

function declaredLength(columnType) {
  const match = /\((\d+)\)/u.exec(columnType);
  return match ? Number(match[1]) : 4294967295;
}

function indexRow(table, index, column, nonUnique = 0) {
  return {
    TABLE_NAME: table,
    INDEX_NAME: index,
    NON_UNIQUE: nonUnique,
    SEQ_IN_INDEX: 1,
    COLUMN_NAME: column,
    SUB_PART: null,
  };
}

test("17. apply-one executa somente a corretiva", async () => {
  const calls = [];
  await runAuthWrite({ onApply: (id) => calls.push(id) });
  assert.deepEqual(calls, [AUTH_RUNTIME_CORRECTIVE_MIGRATION]);
});

test("18. ledger histórico não é marcado automaticamente", async () => {
  const calls = [];
  await runAuthWrite({ onApply: (id) => calls.push(id) });
  assert.ok(!calls.includes(AUTH_RUNTIME_HISTORICAL_MIGRATION));
});

test("19. pós-validação exige utf8mb4/utf8mb4_unicode_ci", () => {
  const before = authApplyState();
  const after = authApplyState({ applied: true, targetOptions: false });
  const assessment = assessApplyOneRequest(before, AUTH_RUNTIME_CORRECTIVE_MIGRATION);
  const validation = validateApplyOnePostState({
    beforeState: before,
    afterState: after,
    assessment,
  });
  assert.equal(validation.checks.selectedTableOptionsExact, false);
  assert.equal(validation.passed, false);
});

test("20. nenhuma tabela fora do escopo Auth Runtime é alterada", async () => {
  const fake = authMetadataFake();
  await createAuthRuntimeCharsetCollationReconciliation({
    queryRunner: fake.query,
    tableExists: fake.tableExists,
  }).up();
  assert.deepEqual(
    fake.alters.map((sql) => /ALTER TABLE `([^`]+)`/iu.exec(sql)[1]),
    TABLES,
  );
});

test("21. nenhuma tabela legada de alunos ou matrículas é tocada", async () => {
  const fake = authMetadataFake();
  await createAuthRuntimeCharsetCollationReconciliation({
    queryRunner: fake.query,
    tableExists: fake.tableExists,
  }).up();
  assert.doesNotMatch(
    fake.alters.join("\n"),
    /j12_usuarios|j12_alunos|j12_matricula_numeros|j12_matriculas_publicas/iu,
  );
});

test("22. fluxo validado usa zero conexões reais", async () => {
  let fakeReaders = 0;
  let writeFactories = 0;
  const output = { write() {} };
  const code = await main(
    [
      "apply-one",
      "--dry-run",
      `--migration=${AUTH_RUNTIME_CORRECTIVE_MIGRATION}`,
      "--confirm-database=j12",
    ],
    {
      env: { DB_HOST: "localhost", DB_NAME: "j12" },
      createClient() {
        fakeReaders += 1;
        return { async close() {} };
      },
      createApplyClient() {
        writeFactories += 1;
      },
      manager: {
        async run() {
          return {
            ...buildApplyOnePlan(authApplyState(), AUTH_RUNTIME_CORRECTIVE_MIGRATION),
            doctorSummary: { severityCounts: {} },
          };
        },
      },
      output,
      errorOutput: output,
    },
  );
  assert.equal(code, 0);
  assert.equal(fakeReaders, 1);
  assert.equal(writeFactories, 0);
});

test("23. zero chamadas a up fora da migration selecionada", async () => {
  let unrelatedUpCalls = 0;
  await runAuthWrite({
    onApply(id) {
      assert.equal(id, AUTH_RUNTIME_CORRECTIVE_MIGRATION);
    },
    unrelatedUp() {
      unrelatedUpCalls += 1;
    },
  });
  assert.equal(unrelatedUpCalls, 0);
});

test("24. documentação registra commit implícito e risco de lock", () => {
  const readme = fs.readFileSync(path.resolve(__dirname, "..", "README.md"), "utf8");
  const migrationSource = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "..",
      "migrations",
      "20260803133000_reconcile_auth_runtime_charset_collation.js",
    ),
    "utf8",
  );
  assert.match(readme, /commit implícito/iu);
  assert.match(readme, /metadata lock|risco de lock/iu);
  assert.match(readme, /restauração via backup/iu);
  assert.match(migrationSource, /interromper escritas/iu);
});

function authPreflight({ targetOptions = false } = {}) {
  return {
    migrationId: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    readOnly: true,
    safeToApply: true,
    riskLevel: "LOW",
    ddlImplicitCommit: true,
    backupRequired: true,
    tableCount: TABLES.length,
    changeCount: targetOptions ? 0 : TABLES.length,
    server: { version: "8.0.36", sqlMode: "STRICT_TRANS_TABLES" },
    tables: TABLES.map((name) => ({
      name,
      charset: targetOptions ? "utf8mb4" : "utf8",
      collation: targetOptions ? "utf8mb4_unicode_ci" : "utf8_unicode_ci",
      expectedCharset: "utf8mb4",
      expectedCollation: "utf8mb4_unicode_ci",
      requiresChange: !targetOptions,
      lockRisk: "LOW",
    })),
    blockers: [],
  };
}

function authApplyState({ applied = false, targetOptions = false, preflight = null } = {}) {
  const historical = {
    id: AUTH_RUNTIME_HISTORICAL_MIGRATION,
    checksum: authRuntimeBaselineAdoption.migrationChecksum,
    dependencies: [],
    ledgerState: LEDGER_STATES.APPLIED,
    checksumMatches: true,
    physicalState: PHYSICAL_STATES.TABLE_OPTION_DRIFT,
    manifestAvailable: true,
    applyPolicy: null,
  };
  const corrective = {
    id: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    checksum: "d".repeat(64),
    dependencies: [AUTH_RUNTIME_HISTORICAL_MIGRATION],
    ledgerState: applied ? LEDGER_STATES.APPLIED : LEDGER_STATES.PENDING,
    checksumMatches: applied ? true : null,
    physicalState: applied ? PHYSICAL_STATES.PRESENT : PHYSICAL_STATES.TABLE_OPTION_DRIFT,
    manifestAvailable: true,
    applyPolicy: {
      reconciliation: true,
      allowedPhysicalStates: [PHYSICAL_STATES.TABLE_OPTION_DRIFT],
      reviewedFindingCodes: ["TABLE_OPTION_MISMATCH", "FORMAL_PHYSICAL_DRIFT"],
      requiresTableConfirmation: true,
      operationalPreflight: "AUTH_RUNTIME_TABLE_OPTIONS",
      plannedActions: [
        {
          kind: "TABLE_OPTIONS",
          tables: TABLES,
          action: "CONVERT_UTF8_TO_UTF8MB4_IF_SAFE",
        },
      ],
    },
  };
  const selectedPreflight = preflight || authPreflight({ targetOptions: applied && targetOptions });
  const tables = {
    j12_usuarios: { charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
    j12_alunos: { columns: { id: { columnType: "varchar(64)" } } },
    unaffected: { columns: { id: { columnType: "bigint" } } },
  };
  for (const table of TABLES)
    tables[table] = {
      charset: targetOptions ? "utf8mb4" : "utf8",
      collation: targetOptions ? "utf8mb4_unicode_ci" : "utf8_unicode_ci",
    };
  return {
    canonicalPlan: [historical, corrective].map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
      state: migration.ledgerState,
    })),
    operationalPreflightByMigration: {
      [AUTH_RUNTIME_CORRECTIVE_MIGRATION]: selectedPreflight,
    },
    doctorReport: {
      database: { host: "localhost", name: "j12", remote: false },
      migrations: [historical, corrective],
      findings: applied
        ? []
        : TABLES.flatMap((table) => [
            {
              code: "TABLE_OPTION_MISMATCH",
              details: {
                migrationId: corrective.id,
                table,
                property: "charset",
              },
            },
            {
              code: "FORMAL_PHYSICAL_DRIFT",
              details: { migrationId: corrective.id },
            },
          ]),
      expectedSchema: [
        {
          migrationId: corrective.id,
          requiredTables: TABLES,
          requiredColumns: [],
          requiredIndexes: [],
          requiredForeignKeys: [],
          requiredGeneratedColumns: [],
        },
      ],
      schemaSnapshot: { tables },
    },
  };
}

async function runAuthWrite({ onApply = () => {}, unrelatedUp = () => {} } = {}) {
  const before = authApplyState();
  const immediate = authApplyState();
  const after = authApplyState({ applied: true, targetOptions: true });
  const token = assessApplyOneRequest(before, AUTH_RUNTIME_CORRECTIVE_MIGRATION).token;
  const states = [before, immediate, after];
  return executeApplyOne({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      runner: {
        async applyOne(id) {
          onApply(id);
          void unrelatedUp;
          return { applied: [id] };
        },
      },
      async close() {},
    }),
    context: {},
    migrationId: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    confirmationToken: token,
    backupIdentifier: "dump-auth-20260803",
    confirmedTables: TABLES,
  });
}
