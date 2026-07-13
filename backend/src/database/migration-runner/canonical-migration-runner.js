const { migrationError } = require("./migration-catalog.js");

const MigrationLedgerStatus = Object.freeze({
  APPLIED: "APPLIED",
  APPLYING: "APPLYING",
  FAILED: "FAILED",
});

class CanonicalMigrationRunner {
  constructor({ catalog = [], executor = null, ledger = null, clock = () => new Date() } = {}) {
    this.catalog = catalog;
    this.executor = executor;
    this.ledger = ledger;
    this.clock = clock;
  }

  async status() {
    const records = this.ledger ? await this.ledger.list() : [];
    return buildStatus(this.catalog, records);
  }

  async up({ dryRun = false } = {}) {
    if (dryRun)
      return {
        applied: [],
        dryRun: true,
        plan: buildStatus(this.catalog, []).map(toPlanItem),
        skipped: [],
      };
    assertRuntimeDependencies(this.executor, this.ledger);

    return this.ledger.withLock(async () => {
      await this.ledger.ensureLedger();
      const initialStatus = buildStatus(this.catalog, await this.ledger.list());
      const blocked = initialStatus.find(
        (item) =>
          item.state === "CHECKSUM_MISMATCH" ||
          item.state === MigrationLedgerStatus.FAILED ||
          item.state === MigrationLedgerStatus.APPLYING ||
          item.state === "ORPHANED",
      );
      if (blocked)
        throw migrationError(
          `Migration ${blocked.id} is ${blocked.state}; refusing to continue.`,
          "MIGRATION_LEDGER_BLOCKED",
          { migrationId: blocked.id, state: blocked.state },
        );

      const result = {
        applied: [],
        dryRun: false,
        plan: initialStatus.map(toPlanItem),
        skipped: [],
      };
      for (const item of initialStatus) {
        if (item.state === MigrationLedgerStatus.APPLIED) {
          result.skipped.push(item.id);
          continue;
        }

        const migration = this.catalog.find((candidate) => candidate.id === item.id);
        const startedAt = this.clock();
        await this.ledger.markApplying(migration, startedAt);
        try {
          await this.executor.apply(migration);
          const appliedAt = this.clock();
          await this.ledger.markApplied(
            migration,
            appliedAt,
            Math.max(0, appliedAt.getTime() - startedAt.getTime()),
          );
          result.applied.push(migration.id);
        } catch (error) {
          await this.ledger.markFailed(migration, this.clock(), sanitizeError(error));
          throw migrationError(`Migration ${migration.id} failed.`, "MIGRATION_EXECUTION_FAILED", {
            cause: error,
            migrationId: migration.id,
          });
        }
      }
      return result;
    });
  }
}

function buildStatus(catalog, records) {
  const recordById = new Map((records || []).map((record) => [record.id, record]));
  const status = catalog.map((migration) => {
    const record = recordById.get(migration.id);
    recordById.delete(migration.id);
    let state = "PENDING";
    if (record)
      state = record.checksum === migration.checksum ? record.status : "CHECKSUM_MISMATCH";
    return {
      ...migration,
      appliedAt: record?.appliedAt || null,
      ledgerChecksum: record?.checksum || null,
      state,
    };
  });

  for (const record of recordById.values()) {
    status.push({
      appliedAt: record.appliedAt || null,
      checksum: null,
      fileName: null,
      id: record.id,
      ledgerChecksum: record.checksum,
      state: "ORPHANED",
      timestamp: null,
    });
  }
  return status;
}

function assertRuntimeDependencies(executor, ledger) {
  if (!executor || typeof executor.apply !== "function")
    throw new TypeError("CanonicalMigrationRunner requires executor.apply().");
  const methods = ["ensureLedger", "list", "markApplied", "markApplying", "markFailed", "withLock"];
  if (!ledger || methods.some((method) => typeof ledger[method] !== "function"))
    throw new TypeError("CanonicalMigrationRunner requires a complete ledger adapter.");
}

function sanitizeError(error) {
  return String(error instanceof Error ? error.message : error || "Migration failed.")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 1000);
}

function toPlanItem(item) {
  return {
    checksum: item.checksum,
    dependencies: item.dependencies || [],
    fileName: item.fileName,
    id: item.id,
    state: item.state,
  };
}

module.exports = { CanonicalMigrationRunner, MigrationLedgerStatus, buildStatus, sanitizeError };
