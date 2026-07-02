/**
 * Stores contextual information for a future transactional execution.
 *
 * This class does not hold database connections, SQL handles or driver-specific
 * state. It is only an in-memory metadata container for future use cases.
 */
class TransactionContext {
  /**
   * @param {Object} [input]
   * @param {string|null} [input.id]
   * @param {string} [input.status]
   * @param {Record<string, unknown>} [input.metadata]
   * @param {string|null} [input.startedAt]
   * @param {string|null} [input.completedAt]
   */
  constructor({ completedAt = null, id = null, metadata = {}, startedAt = null, status = "idle" } = {}) {
    this.id = id;
    this.status = status;
    this.metadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
    this.startedAt = startedAt;
    this.completedAt = completedAt;
  }

  /**
   * @param {string} status
   * @returns {TransactionContext}
   */
  mark(status) {
    this.status = status;
    return this;
  }

  /**
   * @param {Record<string, unknown>} metadata
   * @returns {TransactionContext}
   */
  withMetadata(metadata = {}) {
    this.metadata = {
      ...this.metadata,
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    };
    return this;
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      completedAt: this.completedAt,
      id: this.id,
      metadata: this.metadata,
      startedAt: this.startedAt,
      status: this.status,
    };
  }
}

module.exports = {
  TransactionContext,
};
