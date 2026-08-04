const LEDGER_TABLE = "j12_schema_migrations";
const DEFAULT_LOCK_NAME = "j12:schema-migrations";

class MySqlMigrationLedger {
  constructor({ pool, lockName = DEFAULT_LOCK_NAME, lockTimeoutSeconds = 5 } = {}) {
    if (!pool || typeof pool.getConnection !== "function")
      throw new TypeError("MySqlMigrationLedger requires a pool.");
    this.pool = pool;
    this.lockName = lockName;
    this.lockTimeoutSeconds = lockTimeoutSeconds;
    this.connection = null;
  }

  async withLock(work) {
    if (this.connection)
      throw ledgerError(
        "This ledger instance already holds the migration lock.",
        "MIGRATION_LOCK_REENTRANT",
      );
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute("SELECT GET_LOCK(?, ?) AS acquired", [
        this.lockName,
        this.lockTimeoutSeconds,
      ]);
      if (Number(rows?.[0]?.acquired) !== 1)
        throw ledgerError(
          "Could not acquire the canonical migration lock.",
          "MIGRATION_LOCK_UNAVAILABLE",
        );
      this.connection = connection;
      return await work();
    } finally {
      if (this.connection === connection) {
        try {
          await connection.execute("SELECT RELEASE_LOCK(?) AS released", [this.lockName]);
        } finally {
          this.connection = null;
        }
      }
      connection.release();
    }
  }

  async ensureLedger() {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
        id VARCHAR(191) NOT NULL,
        migration_timestamp CHAR(14) NOT NULL,
        name VARCHAR(191) NOT NULL,
        checksum CHAR(64) NOT NULL,
        status VARCHAR(16) NOT NULL,
        started_at DATETIME(3) NOT NULL,
        applied_at DATETIME(3) NULL,
        failed_at DATETIME(3) NULL,
        execution_ms BIGINT UNSIGNED NULL,
        error_message VARCHAR(1000) NULL,
        PRIMARY KEY (id),
        UNIQUE INDEX ux_j12_schema_migrations_timestamp (migration_timestamp),
        INDEX idx_j12_schema_migrations_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async exists() {
    const [tableRows] = await this.execute(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [LEDGER_TABLE],
      { allowPool: true },
    );
    return Number(tableRows?.[0]?.total) > 0;
  }

  async list() {
    if (!(await this.exists())) return [];
    const [rows] = await this.execute(
      `SELECT id, checksum, status, applied_at FROM ${LEDGER_TABLE} ORDER BY migration_timestamp, id`,
      [],
      { allowPool: true },
    );
    return rows.map((row) => ({
      appliedAt: row.applied_at || null,
      checksum: row.checksum,
      id: row.id,
      status: row.status,
    }));
  }

  async markApplying(migration, startedAt) {
    await this.execute(
      `INSERT INTO ${LEDGER_TABLE} (id, migration_timestamp, name, checksum, status, started_at) VALUES (?, ?, ?, ?, 'APPLYING', ?)`,
      [migration.id, migration.timestamp, migration.name, migration.checksum, startedAt],
    );
  }

  async markApplied(migration, appliedAt, executionMs) {
    const [result] = await this.execute(
      `UPDATE ${LEDGER_TABLE} SET status = 'APPLIED', applied_at = ?, execution_ms = ?, error_message = NULL WHERE id = ? AND checksum = ? AND status = 'APPLYING'`,
      [appliedAt, executionMs, migration.id, migration.checksum],
    );
    if (Number(result?.affectedRows) !== 1)
      throw ledgerError(
        `Ledger transition failed for ${migration.id}.`,
        "MIGRATION_LEDGER_TRANSITION_FAILED",
      );
  }

  async markFailed(migration, failedAt, errorMessage) {
    await this.execute(
      `UPDATE ${LEDGER_TABLE} SET status = 'FAILED', failed_at = ?, error_message = ? WHERE id = ? AND checksum = ? AND status = 'APPLYING'`,
      [failedAt, errorMessage, migration.id, migration.checksum],
    );
  }

  async registerBaseline(migration, appliedAt) {
    const [result] = await this.execute(
      `INSERT INTO ${LEDGER_TABLE} (id, migration_timestamp, name, checksum, status, started_at, applied_at, execution_ms, error_message) VALUES (?, ?, ?, ?, 'APPLIED', ?, ?, 0, NULL)`,
      [
        migration.id,
        migration.timestamp || migration.id.slice(0, 14),
        migration.name,
        migration.checksum,
        appliedAt,
        appliedAt,
      ],
    );
    if (Number(result?.affectedRows) !== 1)
      throw ledgerError(
        `Baseline registration failed for ${migration.id}.`,
        "MIGRATION_BASELINE_REGISTRATION_FAILED",
      );
  }

  async withTransaction(work) {
    if (!this.connection)
      throw ledgerError(
        "A migration lock is required for ledger transaction.",
        "MIGRATION_LOCK_REQUIRED",
      );
    await this.connection.beginTransaction();
    try {
      const result = await work();
      await this.connection.commit();
      return result;
    } catch (error) {
      try {
        await this.connection.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
  }

  async execute(sql, params = [], { allowPool = false } = {}) {
    const executor = this.connection || (allowPool ? this.pool : null);
    if (!executor)
      throw ledgerError(
        "A migration lock is required for ledger mutation.",
        "MIGRATION_LOCK_REQUIRED",
      );
    return executor.execute(sql, params);
  }
}

function ledgerError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { DEFAULT_LOCK_NAME, LEDGER_TABLE, MySqlMigrationLedger, ledgerError };
