const { LoggerInterface, LogLevel } = require("../logger.js");

/**
 * Core logger contract.
 *
 * This module reuses the existing logger interface and log levels. It does not
 * replace current console logging and is not wired to any runtime path.
 */
module.exports = {
  LoggerInterface,
  LogLevel,
};
