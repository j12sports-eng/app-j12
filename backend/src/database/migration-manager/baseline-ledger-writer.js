"use strict";

const { baselineError } = require("./baseline-errors");

class BaselineLedgerWriter {
  constructor({ ledger, clock = () => new Date() } = {}) {
    if (!ledger) throw new TypeError("BaselineLedgerWriter requires a ledger adapter.");
    this.ledger = ledger;
    this.clock = clock;
  }

  async execute(migrations) {
    if (!Array.isArray(migrations) || migrations.length === 0)
      throw baselineError(
        "Baseline write requires a non-empty approved migration list.",
        "BASELINE_EMPTY_SELECTION",
      );
    return this.ledger.withLock(async () => {
      const ledgerExistedBefore = await this.ledger.exists();
      if (!ledgerExistedBefore) {
        try {
          await this.ledger.ensureLedger();
        } catch (error) {
          throw baselineError(
            "Failed to create the canonical ledger.",
            "BASELINE_LEDGER_CREATE_FAILED",
            {
              causeCode: error?.code || null,
            },
          );
        }
        if (!(await this.ledger.exists()))
          throw baselineError(
            "Canonical ledger was not found after creation.",
            "BASELINE_LEDGER_CREATE_FAILED",
          );
      }

      const recordsBefore = await this.ledger.list();
      const pending = this.selectPending(migrations, recordsBefore);
      let recordsAfter = recordsBefore;
      if (pending.length) {
        try {
          recordsAfter = await this.ledger.withTransaction(async () => {
            const currentRecords = await this.ledger.list();
            const currentPending = this.selectPending(migrations, currentRecords);
            const appliedAt = this.clock();
            for (const migration of currentPending)
              await this.ledger.registerBaseline(migration, appliedAt);
            const reread = await this.ledger.list();
            this.assertRegistered(migrations, reread);
            return reread;
          });
        } catch (error) {
          if (error?.code?.startsWith("BASELINE_")) throw error;
          throw baselineError("Baseline ledger transaction failed.", "BASELINE_WRITE_FAILED", {
            causeCode: error?.code || null,
          });
        }
      }
      this.assertRegistered(migrations, recordsAfter);
      return {
        ledgerCreated: !ledgerExistedBefore,
        ddlTransactionSeparated: !ledgerExistedBefore,
        recordsBefore: recordsBefore.length,
        recordsAfter: recordsAfter.length,
        insertedIds: pending.map((migration) => migration.id),
        alreadyAppliedIds: migrations
          .filter((migration) => !pending.some((candidate) => candidate.id === migration.id))
          .map((migration) => migration.id),
        writesPerformed: pending.length > 0 || !ledgerExistedBefore,
      };
    });
  }

  selectPending(migrations, records) {
    const byId = new Map(records.map((record) => [record.id, record]));
    const pending = [];
    for (const migration of migrations) {
      const existing = byId.get(migration.id);
      if (!existing) {
        pending.push(migration);
        continue;
      }
      if (existing.checksum !== migration.checksum)
        throw baselineError(
          `Checksum mismatch for existing ledger record ${migration.id}.`,
          "BASELINE_EXISTING_CHECKSUM_MISMATCH",
          { migrationId: migration.id },
        );
      if (existing.status !== "APPLIED")
        throw baselineError(
          `Existing ledger record ${migration.id} is not APPLIED.`,
          "BASELINE_EXISTING_STATUS_INVALID",
          { migrationId: migration.id, status: existing.status },
        );
    }
    return pending;
  }

  assertRegistered(migrations, records) {
    const byId = new Map(records.map((record) => [record.id, record]));
    for (const migration of migrations) {
      const record = byId.get(migration.id);
      if (!record || record.status !== "APPLIED" || record.checksum !== migration.checksum)
        throw baselineError(
          `Ledger verification failed for ${migration.id}.`,
          "BASELINE_LEDGER_VERIFICATION_FAILED",
          { migrationId: migration.id },
        );
    }
  }
}

module.exports = { BaselineLedgerWriter };
