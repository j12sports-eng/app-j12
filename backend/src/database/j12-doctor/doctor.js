"use strict";

const { discoverMigrationCatalog } = require("../migration-runner/migration-catalog");
const { LEDGER_STATES, PHYSICAL_STATES, SEVERITIES } = require("./constants");
const { inspectSchema } = require("./schema-inspector");
const { criticalEnrollmentManifests } = require("./manifests");
const { assessManifest } = require("./checks/schema-manifest-check");
const { assessLedger, readMigrationLedger } = require("./checks/migration-ledger-check");
const { checkCatalog } = require("./checks/catalog-check");
const { classificationForMigration } = require("../auth-runtime-legacy-contract");

const LEGACY_TABLES = ["j12_alunos", "j12_matricula_numeros", "j12_matriculas_publicas"];

function expectedSchema(manifests) {
  return manifests.map((manifest) => ({
    migrationId: manifest.migrationId || manifest.id,
    requiredTables: manifest.requiredTables,
    requiredColumns: manifest.requiredColumns,
    requiredIndexes: manifest.requiredIndexes,
    requiredForeignKeys: manifest.requiredForeignKeys,
    requiredGeneratedColumns: manifest.requiredGeneratedColumns,
    optionalArtifacts: manifest.optionalArtifacts,
    applyPolicy: manifest.applyPolicy || null,
  }));
}

function correlateMigrations(catalogAssessment, manifestAssessments) {
  const byId = new Map(
    manifestAssessments.map((assessment) => [assessment.migrationId, assessment]),
  );
  const findings = [];
  const migrations = catalogAssessment.migrations.map((migration) => {
    const assessment = byId.get(migration.id);
    const physicalState = assessment?.physicalState || PHYSICAL_STATES.NOT_ASSESSED;
    let driftDetected = false;
    let structuralDrift = false;
    let tableOptionDrift = false;
    let formalDrift = false;
    if (assessment) {
      structuralDrift = assessment.structuralDrift === true;
      tableOptionDrift = assessment.tableOptionDrift === true;
      formalDrift =
        migration.ledgerState !== LEDGER_STATES.APPLIED && assessment.structurallyPresent === true;
      driftDetected =
        (migration.ledgerState === LEDGER_STATES.APPLIED &&
          physicalState !== PHYSICAL_STATES.PRESENT) ||
        (migration.ledgerState !== LEDGER_STATES.APPLIED &&
          physicalState !== PHYSICAL_STATES.ABSENT);
      for (const item of assessment.findings) {
        const severity =
          migration.ledgerState === LEDGER_STATES.APPLIED ? SEVERITIES.CRITICAL : item.severity;
        findings.push({
          ...item,
          severity,
          details: {
            ...item.details,
            migrationId: migration.id,
            ledgerState: migration.ledgerState,
            physicalState,
          },
        });
      }
      if (driftDetected)
        findings.push({
          code: "FORMAL_PHYSICAL_DRIFT",
          severity:
            migration.ledgerState === LEDGER_STATES.APPLIED ? SEVERITIES.CRITICAL : SEVERITIES.HIGH,
          message: `Estado formal e físico divergem em ${migration.id}.`,
          details: { migrationId: migration.id, ledgerState: migration.ledgerState, physicalState },
        });
    }
    return {
      id: migration.id,
      name: migration.name,
      fileName: migration.fileName,
      checksum: migration.checksum,
      dependencies: migration.dependencies,
      ledgerState: migration.ledgerState,
      ledgerStatus: migration.ledgerStatus,
      appliedAt: migration.appliedAt,
      checksumMatches: migration.checksumMatches,
      physicalState,
      driftDetected,
      structuralDrift,
      tableOptionDrift,
      formalDrift,
      driftClassification: structuralDrift
        ? "STRUCTURAL_DRIFT"
        : tableOptionDrift
          ? "TABLE_OPTION_DRIFT"
          : formalDrift
            ? "FORMAL_DRIFT"
            : null,
      requiredArtifactsMissing: assessment?.requiredArtifactsMissing || [],
      artifactMismatches: assessment?.artifactMismatches || [],
      tableOptionDifferences: assessment?.tableOptionDifferences || [],
      manifestAvailable: Boolean(assessment),
      applyPolicy: assessment?.applyPolicy || null,
      authRuntimeClassification: classificationForMigration(migration.id),
    };
  });
  return { migrations, findings };
}

function summarize(report) {
  const severityCounts = Object.fromEntries(
    Object.values(SEVERITIES).map((severity) => [severity, 0]),
  );
  for (const item of report.findings) severityCounts[item.severity] += 1;
  return {
    migrationsTotal: report.migrations.length,
    ledgerApplied: report.migrations.filter((item) => item.ledgerState === LEDGER_STATES.APPLIED)
      .length,
    ledgerPending: report.migrations.filter((item) => item.ledgerState === LEDGER_STATES.PENDING)
      .length,
    physicallyPresent: report.migrations.filter(
      (item) => item.physicalState === PHYSICAL_STATES.PRESENT,
    ).length,
    partiallyPresent: report.migrations.filter(
      (item) => item.physicalState === PHYSICAL_STATES.PARTIAL,
    ).length,
    physicallyAbsent: report.migrations.filter(
      (item) => item.physicalState === PHYSICAL_STATES.ABSENT,
    ).length,
    tableOptionDrift: report.migrations.filter((item) => item.tableOptionDrift).length,
    structuralDrift: report.migrations.filter((item) => item.structuralDrift).length,
    formalDrift: report.migrations.filter((item) => item.formalDrift).length,
    driftDetected: report.migrations.filter((item) => item.driftDetected).length,
    unknown: report.migrations.filter((item) => item.physicalState === PHYSICAL_STATES.NOT_ASSESSED)
      .length,
    severityCounts,
  };
}

function recommendationsFor(findings) {
  const recommendations = [];
  if (findings.some((item) => item.code === "MIGRATION_LEDGER_MISSING"))
    recommendations.push(
      "Não crie baseline automaticamente; valide a origem do schema e planeje uma regularização formal revisada.",
    );
  if (findings.some((item) => item.code === "MIGRATION_CHECKSUM_MISMATCH"))
    recommendations.push(
      "Interrompa qualquer aplicação de migrations e investigue o checksum divergente no catálogo/ledger.",
    );
  if (findings.some((item) => item.code === "FORMAL_PHYSICAL_DRIFT"))
    recommendations.push(
      "Revise cada divergência formal/física e produza uma migration corretiva explícita; não edite o banco manualmente.",
    );
  if (findings.some((item) => item.code === "TABLE_OPTION_MISMATCH"))
    recommendations.push(
      "Trate charset, collation, engine e demais opções de tabela por política explícita: reconciliação versionada ou adoção temporária auditada.",
    );
  if (findings.some((item) => item.code === "DUPLICATE_MIGRATION_NAME"))
    recommendations.push(
      "Mantenha os IDs/timestamps como identidade canônica e revise migrations homônimas antes de novas dependências.",
    );
  if (!recommendations.length)
    recommendations.push("Nenhuma ação corretiva foi identificada pelos checks implementados.");
  return recommendations;
}

async function runDoctor({
  reader,
  databaseName,
  databaseHost = null,
  databaseRemote = false,
  catalogLoader = discoverMigrationCatalog,
  manifests = criticalEnrollmentManifests,
  now = () => new Date(),
}) {
  const catalog = await catalogLoader();
  const schemaSnapshot = await inspectSchema(reader, databaseName);
  const ledger = await readMigrationLedger(reader, schemaSnapshot);
  const ledgerAssessment = assessLedger(catalog, ledger);
  const manifestAssessments = manifests.map((manifest) => assessManifest(schemaSnapshot, manifest));
  const correlation = correlateMigrations(ledgerAssessment, manifestAssessments);
  const findings = [
    ...ledgerAssessment.findings,
    ...checkCatalog(catalog, manifests),
    ...correlation.findings,
  ];
  const legacyObserved = LEGACY_TABLES.filter((name) => schemaSnapshot.tables[name]);
  findings.push({
    code: "LEGACY_READ_ONLY_BOUNDARY",
    severity: SEVERITIES.INFO,
    message: "Tabelas legadas são apenas observadas e nunca usadas como fonte do domínio canônico.",
    details: { observedTables: legacyObserved },
  });
  const report = {
    generatedAt: now().toISOString(),
    database: { host: databaseHost, name: databaseName, remote: databaseRemote },
    summary: null,
    schema: { ...schemaSnapshot.counts, counts: { ...schemaSnapshot.counts } },
    schemaSnapshot,
    expectedSchema: expectedSchema(manifests),
    migrations: correlation.migrations,
    findings,
    criticalFindings: findings.filter((item) => item.severity === SEVERITIES.CRITICAL),
    warnings: findings.filter((item) =>
      [SEVERITIES.WARNING, SEVERITIES.HIGH, SEVERITIES.CRITICAL].includes(item.severity),
    ),
    recommendations: recommendationsFor(findings),
  };
  report.summary = summarize(report);
  report.summary.applied = report.summary.ledgerApplied;
  report.summary.pending = report.summary.ledgerPending;
  report.summary.drifted = report.summary.driftDetected;
  report.summary.findings = report.findings.length;
  return report;
}

module.exports = { LEGACY_TABLES, correlateMigrations, runDoctor, summarize };
