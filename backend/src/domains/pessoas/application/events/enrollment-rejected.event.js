const ENROLLMENT_REJECTED_EVENT = "EnrollmentRejectedEvent";

/**
 * @typedef {Object} EnrollmentRejectedEvent
 * @property {typeof ENROLLMENT_REJECTED_EVENT} type
 * @property {string|null} enrollmentId
 * @property {string|null} rejectedBy
 * @property {string|null} reason
 * @property {string|null} occurredAt
 * @property {Record<string, unknown>} payload
 */

module.exports = {
  ENROLLMENT_REJECTED_EVENT,
};
