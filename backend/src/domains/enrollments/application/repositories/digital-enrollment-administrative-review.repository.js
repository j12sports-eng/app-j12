/**
 * Persistence contract for the administrative review aggregate.
 *
 * updateIfRevisionMatches must atomically persist both `review` and the optional
 * immutable `decision`; no partial decision history may be observable.
 *
 * @typedef {Object} DigitalEnrollmentAdministrativeReviewRepository
 * @property {(enrollmentId: string) => Promise<unknown|null>} findByEnrollmentId
 * @property {(input: Object) => Promise<unknown>} createPendingReview
 * @property {(input: { review: Object, expectedRevision: number, decision?: Object }) => Promise<unknown>} updateIfRevisionMatches
 * @property {(decision: Object) => Promise<unknown>} appendDecision
 * @property {(reviewId: string) => Promise<unknown[]>} listDecisionsByReviewId
 * @property {(commandId: string) => Promise<unknown|null>} findCommandResult
 */
module.exports = {};
