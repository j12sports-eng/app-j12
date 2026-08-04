"use strict";

const { SEVERITIES } = require("./constants");

function formatJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function formatConsole(report, command = "report") {
  const lines = [
    "J12 Doctor — diagnóstico somente leitura",
    `Banco confirmado: ${report.database.name}`,
    `Comando: ${command}`,
    `Resumo: ${report.summary.applied} aplicadas, ${report.summary.pending} pendentes, ${report.summary.drifted} com drift, ${report.summary.findings} achados.`,
  ];
  if (command === "inspect" || command === "check-schema" || command === "report") {
    lines.push(
      `Schema: ${report.schema.counts.tables} tabelas, ${report.schema.counts.columns} colunas, ${report.schema.counts.indexes} entradas de índice, ${report.schema.counts.foreignKeys} FKs.`,
    );
  }
  if (command === "check-migrations" || command === "check-drift" || command === "report") {
    lines.push("Migrations:");
    for (const migration of report.migrations)
      lines.push(
        `  ${migration.id}: formal=${migration.ledgerState} físico=${migration.physicalState}${migration.driftDetected ? " DRIFT" : ""}`,
      );
  }
  const relevantFindings = report.findings.filter(
    (item) => item.severity !== SEVERITIES.INFO || command === "report",
  );
  lines.push("Achados:");
  if (!relevantFindings.length) lines.push("  nenhum");
  for (const item of relevantFindings)
    lines.push(`  [${item.severity}] ${item.code}: ${item.message}`);
  lines.push("Recomendações:");
  for (const recommendation of report.recommendations) lines.push(`  - ${recommendation}`);
  return `${lines.join("\n")}\n`;
}

module.exports = { formatConsole, formatJson };
