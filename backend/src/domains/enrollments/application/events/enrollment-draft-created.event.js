const {
  normalizeEventMetadata,
  nullableText,
} = require("./enrollment-event.helpers.js");

const ENROLLMENT_DRAFT_CREATED_EVENT = "EnrollmentDraftCreated";

/**
 * Internal event emitted after a DRAFT Enrollment is actually persisted.
 */
class EnrollmentDraftCreated {
  /**
   * @param {Object} [input]
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.status]
   * @param {string|null} [input.occurredAt]
   * @param {Record<string, unknown>} [input.metadata]
   */
  constructor({
    enrollmentId = null,
    metadata = {},
    occurredAt = null,
    status = "DRAFT",
    studentPersonId = null,
    studentProfileId = null,
  } = {}) {
    this.type = ENROLLMENT_DRAFT_CREATED_EVENT;
    this.enrollmentId = nullableText(enrollmentId, 64);
    this.studentPersonId = nullableText(studentPersonId, 64);
    this.studentProfileId = nullableText(studentProfileId, 64);
    this.status = nullableText(status, 32);
    this.occurredAt = nullableText(occurredAt, 32);
    this.metadata = normalizeEventMetadata(metadata);
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      enrollmentId: this.enrollmentId,
      metadata: this.metadata,
      occurredAt: this.occurredAt,
      status: this.status,
      studentPersonId: this.studentPersonId,
      studentProfileId: this.studentProfileId,
      type: this.type,
    };
  }
}

module.exports = {
  ENROLLMENT_DRAFT_CREATED_EVENT,
  EnrollmentDraftCreated,
};
