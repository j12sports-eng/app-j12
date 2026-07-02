/**
 * Minimal internal dispatcher for Enrollment domain events.
 *
 * It does not call queues, workers, HTTP clients or external modules. Consumers
 * can inject another dispatcher later without changing the facade contract.
 */
class EnrollmentInternalEventDispatcher {
  /**
   * @param {Object} [options]
   * @param {{ info?: (message: string, context?: Record<string, unknown>) => void }} [options.logger]
   * @param {boolean} [options.retainEvents]
   */
  constructor({ logger = null, retainEvents = false } = {}) {
    this.logger = logger;
    this.retainEvents = Boolean(retainEvents);
    this.events = [];
  }

  /**
   * @param {Record<string, unknown>|{ toJSON: () => Record<string, unknown> }} event
   * @returns {Promise<Record<string, unknown>>}
   */
  async dispatch(event = {}) {
    const payload = typeof event?.toJSON === "function" ? event.toJSON() : normalizeEvent(event);

    if (this.retainEvents) {
      this.events.push(payload);
    }

    if (typeof this.logger?.info === "function") {
      this.logger.info("[enrollments] Internal event dispatched.", {
        enrollmentId: payload.enrollmentId ?? null,
        type: payload.type ?? null,
      });
    }

    return payload;
  }

  /**
   * @returns {Array<Record<string, unknown>>}
   */
  getDispatchedEvents() {
    return [...this.events];
  }
}

/**
 * @param {unknown} event
 * @returns {Record<string, unknown>}
 */
function normalizeEvent(event = {}) {
  return event && typeof event === "object" && !Array.isArray(event) ? { ...event } : {};
}

module.exports = {
  EnrollmentInternalEventDispatcher,
};
