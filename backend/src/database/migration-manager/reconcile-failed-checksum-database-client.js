"use strict";

const mysql = require("mysql2/promise");
const { MySqlMigrationLedger } = require("../migration-runner/mysql-migration-ledger");

async function createReconcileFailedChecksumWriteClient(config, dependencies = {}) {
  const createPool = dependencies.createPool || mysql.createPool;
  const pool = createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    multipleStatements: false,
  });

  return Object.freeze({
    ledger: new MySqlMigrationLedger({ pool }),
    async close() {
      await pool.end();
    },
  });
}

module.exports = { createReconcileFailedChecksumWriteClient };
