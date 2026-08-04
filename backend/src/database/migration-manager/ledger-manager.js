"use strict";

const LEDGER_TABLE = "j12_schema_migrations";

function ledgerExists(doctorReport) {
  return Boolean(doctorReport?.schemaSnapshot?.tables?.[LEDGER_TABLE]);
}

function createBaselineLedgerRecord(migration) {
  return Object.freeze({
    id: migration.id,
    migrationTimestamp: migration.id.slice(0, 14),
    name: migration.name,
    checksum: migration.checksum,
    status: "APPLIED",
    appliedAt: "<execution-time>",
    registrationMode: "BASELINE",
  });
}

function buildLedgerPrerequisites(doctorReport) {
  const exists = ledgerExists(doctorReport);
  return {
    table: LEDGER_TABLE,
    exists,
    wouldRequireCreation: !exists,
    writesPerformed: false,
    note: exists
      ? "O ledger existente seria reutilizado em uma etapa futura explicitamente autorizada."
      : "O ledger não existe; sua criação exigirá uma etapa futura explicitamente autorizada.",
  };
}

module.exports = {
  LEDGER_TABLE,
  buildLedgerPrerequisites,
  createBaselineLedgerRecord,
  ledgerExists,
};
