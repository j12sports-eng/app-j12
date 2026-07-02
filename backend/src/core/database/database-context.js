/**
 * @typedef {Object} DatabaseExecutor
 * @property {(sql: string, params?: Array<unknown>) => Promise<unknown>} execute
 */

/**
 * @typedef {Object} DatabaseContextOptions
 * @property {DatabaseExecutor|null} [executor]
 * @property {unknown|null} [transaction]
 */

/**
 * Lightweight holder for database execution dependencies used by future
 * repositories. It does not open connections and is not wired to runtime code.
 */
class DatabaseContext {
  /**
   * @param {DatabaseContextOptions} [options]
   */
  constructor({ executor = null, transaction = null } = {}) {
    this.executor = executor;
    this.transaction = transaction;
  }

  /**
   * @returns {boolean}
   */
  hasExecutor() {
    return typeof this.executor?.execute === "function";
  }
}

module.exports = {
  DatabaseContext,
};
