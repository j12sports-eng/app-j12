class MemoryDigitalEnrollmentAdministrativeReviewRepository {
  constructor() {
    this.rows = new Map();
    this.decisions = new Map();
    this.commands = new Map();
  }

  async findByEnrollmentId(enrollmentId) {
    return this.rows.get(enrollmentId) || null;
  }

  async findCommandResult(commandId) {
    return this.commands.get(commandId) || null;
  }

  async createPendingReview({ commandId, fingerprint, review }) {
    const previous = this.commands.get(commandId);
    if (previous) return resolveRetry(previous, fingerprint);
    if (this.rows.has(review.enrollmentId)) throw conflict();
    this.rows.set(review.enrollmentId, review);
    this.commands.set(commandId, { fingerprint, review });
    return review;
  }

  async updateIfRevisionMatches({ commandId, decision = null, expectedRevision, fingerprint, review }) {
    const previous = this.commands.get(commandId);
    if (previous) return resolveRetry(previous, fingerprint);
    const current = this.rows.get(review.enrollmentId);
    if (!current || current.revision !== expectedRevision) throw conflict();

    // One synchronous critical section makes state and immutable history atomic in memory.
    const nextDecisions = [...(this.decisions.get(review.id) || [])];
    if (decision) nextDecisions.push(Object.freeze({ ...decision }));
    this.rows.set(review.enrollmentId, review);
    this.decisions.set(review.id, Object.freeze(nextDecisions));
    this.commands.set(commandId, { fingerprint, review });
    return review;
  }

  async appendDecision(decision) {
    const rows = [...(this.decisions.get(decision.reviewId) || [])];
    rows.push(Object.freeze({ ...decision }));
    this.decisions.set(decision.reviewId, Object.freeze(rows));
    return decision;
  }

  async listDecisionsByReviewId(reviewId) {
    return [...(this.decisions.get(reviewId) || [])];
  }
}

function resolveRetry(previous, fingerprint) {
  if (previous.fingerprint !== fingerprint) throw idempotencyConflict();
  return previous.review;
}
function conflict() {
  const error = new Error("Digital enrollment administrative review conflict.");
  error.code = "DIGITAL_ENROLLMENT_REVIEW_CONFLICT";
  error.statusCode = 409;
  return error;
}
function idempotencyConflict() {
  const error = new Error("Digital enrollment review command conflicts with a previous command.");
  error.code = "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT";
  error.statusCode = 409;
  return error;
}

module.exports = {
  MemoryDigitalEnrollmentAdministrativeReviewRepository,
  conflict,
  idempotencyConflict,
};
