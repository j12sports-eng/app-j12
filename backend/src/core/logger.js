/**
 * Supported log levels for future logger implementations.
 */
const LogLevel = Object.freeze({
  DEBUG: "debug",
  ERROR: "error",
  INFO: "info",
  WARN: "warn",
});

/**
 * Interface-like base class for future loggers.
 *
 * Current runtime logging still uses existing console calls. This contract is
 * not wired to routes, controllers or services in this Sprint.
 */
class LoggerInterface {
  /**
   * Writes a debug message.
   *
   * @throws {Error} When the concrete logger does not implement the method.
   */
  debug() {
    throw new Error("LoggerInterface.debug must be implemented.");
  }

  /**
   * Writes an error message.
   *
   * @throws {Error} When the concrete logger does not implement the method.
   */
  error() {
    throw new Error("LoggerInterface.error must be implemented.");
  }

  /**
   * Writes an informational message.
   *
   * @throws {Error} When the concrete logger does not implement the method.
   */
  info() {
    throw new Error("LoggerInterface.info must be implemented.");
  }

  /**
   * Writes a warning message.
   *
   * @throws {Error} When the concrete logger does not implement the method.
   */
  warn() {
    throw new Error("LoggerInterface.warn must be implemented.");
  }
}

module.exports = {
  LoggerInterface,
  LogLevel,
};
