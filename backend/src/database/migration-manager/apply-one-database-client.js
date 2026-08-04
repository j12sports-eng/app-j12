"use strict";

const mysql = require("mysql2/promise");
const { CanonicalMigrationRunner } = require("../migration-runner/canonical-migration-runner");
const { discoverMigrationCatalog } = require("../migration-runner/migration-catalog");
const { MigrationExecutor } = require("../migration-runner/migration-executor");
const { MySqlMigrationLedger } = require("../migration-runner/mysql-migration-ledger");

async function createApplyOneWriteClient(config, dependencies = {}) {
  const createPool = dependencies.createPool || mysql.createPool;
  const catalogLoader = dependencies.catalogLoader || discoverMigrationCatalog;
  const pool = createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    multipleStatements: false,
  });
  const catalog = await catalogLoader();
  const ledger = new MySqlMigrationLedger({ pool });
  const executor = new MigrationExecutor({
    query: async (sql, params) => {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
  });
  return Object.freeze({
    runner: new CanonicalMigrationRunner({ catalog, executor, ledger }),
    async close() {
      await pool.end();
    },
  });
}

module.exports = { createApplyOneWriteClient };
