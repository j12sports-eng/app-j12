const ENROLLMENT_APPROVED_EVENT = "EnrollmentApprovedEvent";

/**
 * @typedef {Object} EnrollmentApprovedEvent
 * @property {typeof ENROLLMENT_APPROVED_EVENT} type
 * @property {string|null} enrollmentId
 * @property {string|null} approvedBy
 * @property {string|null} occurredAt
 * @property {Record<string, unknown>} payload
 */

module.exports = {
  ENROLLMENT_APPROVED_EVENT,
};
