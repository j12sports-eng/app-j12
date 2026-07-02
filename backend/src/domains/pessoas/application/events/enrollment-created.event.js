const ENROLLMENT_CREATED_EVENT = "EnrollmentCreatedEvent";

/**
 * @typedef {Object} EnrollmentCreatedEvent
 * @property {typeof ENROLLMENT_CREATED_EVENT} type
 * @property {string|null} enrollmentId
 * @property {string|null} occurredAt
 * @property {Record<string, unknown>} payload
 * @property {Record<string, unknown>} metadata
 */

class EnrollmentCreatedEvent {
  /**
   * @param {Object} [input]
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.occurredAt]
   * @param {Record<string, unknown>} [input.payload]
   * @param {Record<string, unknown>} [input.metadata]
   */
  constructor({ enrollmentId = null, metadata = {}, occurredAt = null, payload = {} } = {}) {
    this.type = ENROLLMENT_CREATED_EVENT;
    this.enrollmentId = enrollmentId;
    this.occurredAt = occurredAt;
    this.payload = payload && typeof payload === "object" ? { ...payload } : {};
    this.metadata = {
      dispatched: false,
      preparedOnly: true,
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    };
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      enrollmentId: this.enrollmentId,
      metadata: this.metadata,
      occurredAt: this.occurredAt,
      payload: this.payload,
      type: this.type,
    };
  }
}

module.exports = {
  ENROLLMENT_CREATED_EVENT,
  EnrollmentCreatedEvent,
};
