"use strict";

const SUPPORTED_COMMANDS = Object.freeze(["plan", "baseline", "apply-one", "validate"]);
const RESERVED_COMMANDS = Object.freeze(["apply", "report"]);

class MigrationManagerUsageError extends Error {
  constructor(message, code = "MIGRATION_MANAGER_USAGE") {
    super(message);
    this.name = "MigrationManagerUsageError";
    this.code = code;
  }
}

class MigrationManagerUnavailableError extends Error {
  constructor(command) {
    super(`Comando ${command} reservado, mas não implementado nesta etapa somente leitura.`);
    this.name = "MigrationManagerUnavailableError";
    this.code = "MIGRATION_MANAGER_COMMAND_UNAVAILABLE";
  }
}

module.exports = {
  MigrationManagerUnavailableError,
  MigrationManagerUsageError,
  RESERVED_COMMANDS,
  SUPPORTED_COMMANDS,
};
