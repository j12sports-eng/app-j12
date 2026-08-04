"use strict";

const { MigrationManagerUnavailableError } = require("./constants");

function rollbackMigration() {
  throw new MigrationManagerUnavailableError("rollback");
}

module.exports = { rollbackMigration };
