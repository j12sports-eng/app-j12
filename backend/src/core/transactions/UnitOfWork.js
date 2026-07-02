const { TransactionManager } = require("./TransactionManager.js");

/**
 * Coordinates a future transactional unit without executing SQL.
 *
 * The unit receives a TransactionContext and decides what to do with it. In
 * Sprint 9.2 this remains driver-agnostic and detached from repositories.
 */
class UnitOfWork {
  /**
   * @param {Object} [options]
   * @param {TransactionManager} [options.transactionManager]
   */
  constructor({ transactionManager = new TransactionManager() } = {}) {
    this.transactionManager = transactionManager;
  }

  /**
   * @template T
   * @param {(context: import("./TransactionContext.js").TransactionContext) => Promise<T>|T} unit
   * @param {Record<string, unknown>} [metadata]
   * @returns {Promise<T>}
   */
  async execute(unit, metadata = {}) {
    if (typeof unit !== "function") {
      throw new TypeError("UnitOfWork.execute requires a unit function.");
    }

    const context = await this.transactionManager.begin(metadata);

    try {
      const result = await unit(context);
      await this.transactionManager.commit(context);
      return result;
    } catch (error) {
      await this.transactionManager.rollback(context);
      throw error;
    }
  }
}

module.exports = {
  UnitOfWork,
};
