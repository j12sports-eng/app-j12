"use strict";

const { LEDGER_STATES, SEVERITIES } = require("../constants");

async function readMigrationLedger(reader, schema) {
  if (!schema.tables.j12_schema_migrations) return { exists: false, rows: [] };
  const requiredColumns = ["id", "checksum", "status", "applied_at", "migration_timestamp"];
  const missingColumns = requiredColumns.filter(
    (column) => !schema.tables.j12_schema_migrations.columns[column],
  );
  if (missingColumns.length) return { exists: true, rows: [], missingColumns };
  const result = await reader.query(`SELECT id, checksum, status, applied_at
    FROM j12_schema_migrations ORDER BY migration_timestamp, id`);
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return {
    exists: true,
    rows: rows.map((row) => ({
      id: row.id,
      checksum: row.checksum,
      status: row.status,
      appliedAt: row.applied_at || null,
    })),
  };
}

function assessLedger(catalog, ledger) {
  const byId = new Map(ledger.rows.map((row) => [row.id, row]));
  const findings = [];
  if (ledger.missingColumns?.length) {
    findings.push({
      code: "MIGRATION_LEDGER_SCHEMA_INCOMPATIBLE",
      severity: SEVERITIES.CRITICAL,
      message: "Ledger j12_schema_migrations possui schema incompatÃ­vel.",
      details: { missingColumns: ledger.missingColumns },
    });
  }
  const migrations = catalog.map((migration) => {
    const row = byId.get(migration.id);
    let ledgerState = LEDGER_STATES.PENDING;
    if (row?.status === "APPLIED") ledgerState = LEDGER_STATES.APPLIED;
    else if (row) ledgerState = LEDGER_STATES.UNKNOWN;
    if (row && row.checksum !== migration.checksum)
      findings.push({
        code: "MIGRATION_CHECKSUM_MISMATCH",
        severity: SEVERITIES.CRITICAL,
        message: `Checksum divergente em ${migration.id}.`,
        details: { migrationId: migration.id },
      });
    if (row && row.status !== "APPLIED")
      findings.push({
        code: "MIGRATION_LEDGER_STATUS",
        severity: SEVERITIES.HIGH,
        message: `Estado formal inesperado em ${migration.id}: ${row.status}.`,
        details: { migrationId: migration.id, status: row.status },
      });
    return {
      ...migration,
      ledgerState,
      ledgerStatus: row?.status || null,
      appliedAt: row?.appliedAt || null,
      checksumMatches: row ? row.checksum === migration.checksum : null,
    };
  });
  for (const row of ledger.rows)
    if (!catalog.some((migration) => migration.id === row.id))
      findings.push({
        code: "LEDGER_MIGRATION_UNKNOWN",
        severity: SEVERITIES.HIGH,
        message: `Ledger contém migration inexistente no catálogo: ${row.id}.`,
        details: { migrationId: row.id },
      });
  if (!ledger.exists)
    findings.push({
      code: "MIGRATION_LEDGER_MISSING",
      severity: SEVERITIES.CRITICAL,
      message: "Ledger j12_schema_migrations ausente; migrations ficam formalmente pendentes.",
      details: {},
    });
  return { migrations, findings };
}

module.exports = { assessLedger, readMigrationLedger };
