"use strict";

const mysql = require("mysql2/promise");
const { MySqlMigrationLedger } = require("../migration-runner/mysql-migration-ledger");
const { BaselineLedgerWriter } = require("./baseline-ledger-writer");

function createBaselineWriteClient(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    multipleStatements: false,
  });
  const ledger = new MySqlMigrationLedger({ pool });
  return Object.freeze({
    writer: new BaselineLedgerWriter({ ledger }),
    async close() {
      await pool.end();
    },
  });
}

module.exports = { createBaselineWriteClient };
