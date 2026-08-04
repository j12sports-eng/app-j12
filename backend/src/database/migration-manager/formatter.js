"use strict";

function formatJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function formatConsole(report) {
  const lines = [
    "J12 Migration Manager — modo somente leitura",
    `Comando: ${report.command}`,
    `Banco: ${report.database.name} (${report.database.remote ? "remoto" : "local"})`,
  ];
  if (report.mode === "WRITE") lines[0] = "J12 Migration Manager — baseline controlado";
  if (report.command === "apply-one" && report.mode === "WRITE")
    lines[0] = "J12 Migration Manager — aplicação unitária controlada";
  if (report.command === "plan") {
    lines.push(
      `Fisicamente presentes: ${report.summary.physicallyPresent}`,
      `Fisicamente ausentes: ${report.summary.physicallyAbsent}`,
      `Drift estrutural: ${report.summary.structuralDrift}`,
      `Drift formal: ${report.summary.formalDrift}`,
      `Drift de opções de tabela: ${report.summary.tableOptionDrift || 0}`,
      `Prontas para baseline: ${report.summary.baselineReady}`,
      `Bloqueadas para baseline: ${report.summary.baselineBlocked}`,
      `Unknown: ${report.summary.unknown}`,
    );
    appendIds(lines, "Migrations fisicamente presentes", report.physicallyPresent);
    appendIds(lines, "Migrations fisicamente ausentes", report.physicallyAbsent);
    appendEligibilityIds(lines, "Drift estrutural", report.structuralDrift);
    appendEligibilityIds(lines, "Drift formal", report.formalDrift);
    appendEligibilityIds(lines, "Drift de opções de tabela", report.tableOptionDrift);
    appendEligibilityIds(lines, "Prontas para baseline", report.baselineReady);
    appendEligibilityIds(lines, "Bloqueadas para baseline", report.baselineBlocked);
  } else if (report.command === "baseline" && report.mode === "WRITE") {
    lines.push(
      "Modo: WRITE",
      `Ledger criado: ${report.ledgerCreated ? "sim" : "não"}`,
      `Registros antes/depois: ${report.recordsBefore}/${report.recordsAfter}`,
      `Escrita realizada: ${report.writesPerformed ? "sim" : "não"}`,
      `Token confirmado: ${report.tokenConfirmed}`,
      `Validação posterior: ${report.postValidation?.passed ? "aprovada" : "reprovada"}`,
      `Timestamp: ${report.timestamp}`,
    );
    appendIds(
      lines,
      "Migrations registradas",
      report.registeredIds.map((id) => ({ id })),
    );
    appendIds(
      lines,
      "Migrations já aplicadas",
      report.alreadyAppliedIds.map((id) => ({ id })),
    );
  } else if (report.command === "baseline") {
    lines.push(
      "Modo: DRY_RUN",
      "Escritas realizadas: não",
      `Registros propostos: ${report.summary.ready}`,
      `Candidatas bloqueadas: ${report.summary.blocked}`,
    );
    lines.push(
      `Token esperado: ${report.confirmation.expectedToken}`,
      `Lista --only: ${report.confirmation.only.join(",") || "nenhuma"}`,
    );
    appendIds(
      lines,
      "Registros propostos",
      report.registrations.map((registration) => ({
        ...registration,
        reason: registration.informationalReasons?.join(",") || null,
      })),
    );
    appendEligibilityIds(lines, "Bloqueios", report.blocked);
  } else if (report.command === "apply-one" && report.mode === "WRITE") {
    lines.push(
      "Modo: WRITE",
      `Migration aplicada: ${report.migrationId}`,
      `Checksum: ${report.checksum}`,
      `Backup confirmado: ${report.backupIdentifier}`,
      `Tabelas confirmadas: ${report.confirmedTables?.join(",") || "nenhuma"}`,
      `Token confirmado: ${report.tokenConfirmed}`,
      `Validação posterior: ${report.postValidation?.passed ? "aprovada" : "reprovada"}`,
      `Timestamp: ${report.timestamp}`,
    );
  } else if (report.command === "apply-one") {
    lines.push(
      "Modo: DRY_RUN",
      "Escritas realizadas: não",
      `Migration: ${report.migration.id}`,
      `Checksum: ${report.migration.checksum}`,
      `Dependências: ${report.migration.dependencies.join(",") || "nenhuma"}`,
      `Ledger: ${report.migration.ledgerState}`,
      `Estado físico: ${report.migration.physicalState}`,
      `Elegível: ${report.eligible ? "sim" : "não"}`,
      `Risco: ${report.risk.level}; DDL implícito: ${report.risk.ddlImplicitCommit ? "sim" : "não"}`,
      `Token esperado: ${report.confirmation.expectedToken}`,
      `Confirmação de tabelas: ${report.confirmation.requiredTableFlag || "não exigida"}`,
    );
    appendOperationalPreflight(lines, report.operationalPreflight);
    appendIds(
      lines,
      "Ações previstas",
      report.actions.map((action) => ({
        id: `${action.kind} ${action.table || action.tables?.join(",") || "escopo"}${action.name ? `.${action.name}` : ""}`,
        reason: action.action,
      })),
    );
    appendIds(
      lines,
      "Motivos de bloqueio",
      report.reasons.map((reason) => ({ id: reason })),
    );
  } else if (report.command === "validate") {
    lines.push(
      `Válido: ${report.valid ? "sim" : "não"}`,
      `Catálogo: ${report.catalog.total}`,
      `Ledger aplicadas/pendentes: ${report.ledger.applied}/${report.ledger.pending}`,
      `Drift formal: ${report.summary.formalDriftCount}`,
      `Baseline prontas/bloqueadas: ${report.summary.baselineReadyCount}/${report.summary.baselineBlockedCount}`,
      `Ownership ambiguo: ${report.summary.ambiguousOwnershipCount}`,
      `Drift estrutural: ${report.physicalSchema.structuralDrift.length}`,
      `Drift de opções de tabela: ${report.physicalSchema.tableOptionDrift?.length || 0}`,
      `Achados críticos: ${report.criticalFindings.length}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function appendOperationalPreflight(lines, preflight) {
  if (!preflight) return;
  lines.push(
    "Preflight operacional:",
    `  MySQL: ${preflight.server.version || "desconhecido"}`,
    `  sql_mode: ${preflight.server.sqlMode || "não informado"}`,
    `  Seguro para aplicação: ${preflight.safeToApply ? "sim" : "não"}`,
    `  Tabelas avaliadas/conversões: ${preflight.tableCount}/${preflight.changeCount}`,
    `  Risco qualitativo: ${preflight.riskLevel}`,
    `  Commit implícito de DDL: ${preflight.ddlImplicitCommit ? "sim" : "não"}`,
    `  Backup obrigatório: ${preflight.backupRequired ? "sim" : "não"}`,
  );
  for (const table of preflight.tables) {
    lines.push(
      `  ${table.name}: ${table.charset}/${table.collation} -> ${table.expectedCharset}/${table.expectedCollation}; linhas~${table.rowsEstimate ?? "?"}; rebuild~${table.estimatedRebuildBytes ?? "?"} bytes; lock ${table.lockRisk}`,
    );
  }
  for (const blocker of preflight.blockers)
    lines.push(`  bloqueio: ${blocker.code} (${blocker.table || "global"})`);
}

function appendIds(lines, title, entries) {
  lines.push(`${title}:`);
  if (!entries.length) lines.push("  nenhuma");
  for (const entry of entries)
    lines.push(`  ${entry.id}${entry.reason ? ` — ${entry.reason}` : ""}`);
}

function appendEligibilityIds(lines, title, entries) {
  lines.push(`${title}:`);
  if (!entries.length) lines.push("  nenhuma");
  for (const entry of entries) {
    lines.push(`  ${entry.id || entry.migrationId}`);
    if (entry.state) lines.push(`    - ${entry.state}`);
    for (const reason of entry.informationalReasons || []) lines.push(`    - ${reason}`);
    for (const reason of entry.reasons || []) lines.push(`    - ${reason}`);
  }
}

module.exports = { appendOperationalPreflight, formatConsole, formatJson };
