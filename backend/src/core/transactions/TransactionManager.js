const { TransactionContext } = require("./TransactionContext.js");

/**
 * Structural transaction manager for future application use cases.
 *
 * Sprint 9.2 intentionally does not connect this class to mysql2 or any real
 * database transaction primitive.
 */
class TransactionManager {
  /**
   * @param {Object} [options]
   * @param {() => string} [options.idFactory]
   * @param {() => string} [options.clock]
   */
  constructor({ clock = nowIso, idFactory = createTransactionId } = {}) {
    this.clock = clock;
    this.idFactory = idFactory;
  }

  /**
   * Starts a conceptual transaction context.
   *
   * @param {Record<string, unknown>} [metadata]
   * @returns {Promise<TransactionContext>}
   */
  async begin(metadata = {}) {
    return new TransactionContext({
      id: this.idFactory(),
      metadata,
      startedAt: this.clock(),
      status: "started",
    });
  }

  /**
   * Marks a conceptual context as committed.
   *
   * @param {TransactionContext} context
   * @returns {Promise<TransactionContext>}
   */
  async commit(context) {
    assertContext(context);
    context.completedAt = this.clock();
    return context.mark("committed");
  }

  /**
   * Marks a conceptual context as rolled back.
   *
   * @param {TransactionContext} context
   * @returns {Promise<TransactionContext>}
   */
  async rollback(context) {
    assertContext(context);
    context.completedAt = this.clock();
    return context.mark("rolled_back");
  }
}

/**
 * @param {unknown} context
 */
function assertContext(context) {
  if (!(context instanceof TransactionContext)) {
    throw new TypeError("TransactionContext instance is required.");
  }
}

/**
 * @returns {string}
 */
function createTransactionId() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  TransactionManager,
  assertContext,
};
