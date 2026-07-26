const { createHash, randomUUID } = require("node:crypto");

const {
  DigitalEnrollmentAdministrativeReview,
  REVIEW_STATUSES,
  invalid,
} = require(
  "../../domain/entities/digital-enrollment-administrative-review.entity.js",
);

class DigitalEnrollmentAdministrativeReviewService {
  constructor({
    authorizationPolicy = null,
    clock = () => new Date().toISOString(),
    eligibilityPolicy = null,
    idGenerator = randomUUID,
    logger = null,
    repository = null,
  } = {}) {
    Object.assign(this, {
      authorizationPolicy,
      clock,
      eligibilityPolicy,
      idGenerator,
      logger,
      repository,
    });
  }

  async resolveIdempotentCommand(commandId, commandFingerprint) {
    if (typeof this.repository?.findCommandResult !== "function") {
      throw dependencyUnavailable();
    }

    const previous = await this.repository.findCommandResult(commandId);

    if (!previous) {
      return null;
    }

    if (previous.fingerprint !== commandFingerprint) {
      const error = new Error(
        "Digital enrollment review command conflicts with a previous command.",
      );

      error.code = "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT";
      error.statusCode = 409;
      error.expose = true;

      throw error;
    }

    return previous.review;
  }

  async startReview(command = {}) {
    const input = baseCommand(command);

    await this.authorize("START_REVIEW", input.actorAuthIdentityId);

    const commandFingerprint = fingerprint("START_REVIEW", command);

    const previous = await this.resolveIdempotentCommand(
      input.commandId,
      commandFingerprint,
    );

    if (previous) {
      return toDto(previous);
    }

    if (typeof this.eligibilityPolicy?.evaluate !== "function") {
      throw dependencyUnavailable();
    }

    this.eligibilityPolicy.evaluate(command.eligibility);

    const now = this.clock();

    const review = new DigitalEnrollmentAdministrativeReview({
      createdAt: now,
      enrollmentId: input.enrollmentId,
      id: this.idGenerator(),
      responsibleRelationshipId: required(
        command.responsibleRelationshipId,
        "responsibleRelationshipId",
      ),
      submittedAt: now,
      updatedAt: now,
    });

    return this.persistCreate(input, review, command);
  }

  async approveReview(command = {}) {
    return this.decide(command, REVIEW_STATUSES.APPROVED, "APPROVED");
  }

  async requestCorrection(command = {}) {
    return this.decide(
      command,
      REVIEW_STATUSES.CORRECTION_REQUESTED,
      command.decisionCode,
    );
  }

  async rejectReview(command = {}) {
    return this.decide(
      command,
      REVIEW_STATUSES.REJECTED,
      command.decisionCode,
    );
  }

  async resubmitForReview(command = {}) {
    const input = baseCommand(command);

    await this.authorize("RESUBMIT_REVIEW", input.actorAuthIdentityId);

    const commandFingerprint = fingerprint("RESUBMIT_REVIEW", command);

    const previous = await this.resolveIdempotentCommand(
      input.commandId,
      commandFingerprint,
    );

    if (previous) {
      return toDto(previous);
    }

    const current = await this.load(input.enrollmentId);

    validateRevision(current, command.revision);

    const review = current.resubmit({
      correctionItems: command.correctionItems,
      now: this.clock(),
    });

    return this.persistUpdate(input, current, review, command);
  }

  async getReviewStatus(command = {}) {
    const enrollmentId = required(command.enrollmentId, "enrollmentId");

    await this.authorize(
      "GET_REVIEW_STATUS",
      required(command.actorAuthIdentityId, "actorAuthIdentityId"),
    );

    return toDto(await this.load(enrollmentId));
  }

  async decide(command = {}, status, decisionCode) {
    const input = baseCommand(command);

    const reviewerAuthIdentityId = required(
      command.reviewerAuthIdentityId,
      "reviewerAuthIdentityId",
    );

    await this.authorize(status, reviewerAuthIdentityId);

    const commandFingerprint = fingerprint(status, command);

    const previous = await this.resolveIdempotentCommand(
      input.commandId,
      commandFingerprint,
    );

    if (previous) {
      return toDto(previous);
    }

    const current = await this.load(input.enrollmentId);

    validateRevision(current, command.revision);

    const payload = {
      correctionItems: command.correctionItems,
      decisionCode,
      decisionReason: command.decisionReason,
      now: this.clock(),
      reviewerAuthIdentityId,
      status,
    };

    const review =
      status === REVIEW_STATUSES.CORRECTION_REQUESTED
        ? current.requestCorrection(payload)
        : current.decide(payload);

    const decision = Object.freeze({
      commandId: input.commandId,
      decidedAt: review.decidedAt,
      decisionCode: review.decisionCode,
      decisionReason: review.decisionReason,
      reviewId: review.id,
      reviewRound: review.reviewRound,
      reviewerAuthIdentityId,
      status,
    });

    return this.persistUpdate(
      input,
      current,
      review,
      command,
      decision,
    );
  }

  async authorize(action, actorAuthIdentityId) {
    if (typeof this.authorizationPolicy?.authorize !== "function") {
      throw dependencyUnavailable();
    }

    const result = await this.authorizationPolicy.authorize({
      action,
      actorAuthIdentityId,
    });

    if (result !== true && result?.authorized !== true) {
      const error = new Error(
        "Administrative review action is forbidden.",
      );

      error.code = "DIGITAL_ENROLLMENT_REVIEW_FORBIDDEN";
      error.statusCode = 403;

      throw error;
    }
  }

  async load(enrollmentId) {
    if (typeof this.repository?.findByEnrollmentId !== "function") {
      throw dependencyUnavailable();
    }

    const review = await this.repository.findByEnrollmentId(enrollmentId);

    if (!review) {
      const error = new Error(
        "Digital enrollment administrative review was not found.",
      );

      error.code = "DIGITAL_ENROLLMENT_REVIEW_NOT_FOUND";
      error.statusCode = 404;

      throw error;
    }

    return review;
  }

  async persistCreate(input, review, command) {
    if (typeof this.repository?.createPendingReview !== "function") {
      throw dependencyUnavailable();
    }

    const saved = await this.repository.createPendingReview({
      commandId: input.commandId,
      fingerprint: fingerprint("START_REVIEW", command),
      review,
    });

    this.log("START_REVIEW", saved);

    return toDto(saved);
  }

  async persistUpdate(
    input,
    current,
    review,
    command,
    decision = null,
  ) {
    if (
      typeof this.repository?.updateIfRevisionMatches !== "function"
    ) {
      throw dependencyUnavailable();
    }

    const operation = decision?.status || "RESUBMIT_REVIEW";

    const saved = await this.repository.updateIfRevisionMatches({
      commandId: input.commandId,
      decision,
      expectedRevision: current.revision,
      fingerprint: fingerprint(operation, command),
      review,
    });

    this.log(operation, saved);

    return toDto(saved);
  }

  log(operation, review) {
    this.logger?.info?.(
      "[enrollments] administrative review operation",
      {
        enrollmentId: review.enrollmentId,
        operation,
        reviewId: review.id,
        status: review.status,
      },
    );
  }
}

function baseCommand(command = {}) {
  return {
    actorAuthIdentityId: required(
      command.actorAuthIdentityId,
      "actorAuthIdentityId",
    ),
    commandId: required(command.commandId, "commandId"),
    enrollmentId: required(command.enrollmentId, "enrollmentId"),
  };
}

function validateRevision(review, revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw invalid("revision is required.");
  }

  if (review.revision !== revision) {
    const error = new Error(
      "Digital enrollment administrative review conflict.",
    );

    error.code = "DIGITAL_ENROLLMENT_REVIEW_CONFLICT";
    error.statusCode = 409;

    throw error;
  }
}

function fingerprint(operation, command = {}) {
  const canonical = {
    actorAuthIdentityId: command.actorAuthIdentityId,
    correctionItems: Array.isArray(command.correctionItems)
      ? [...command.correctionItems].map(String).sort()
      : null,
    decisionCode: command.decisionCode || null,
    decisionReason: command.decisionReason
      ? String(command.decisionReason).trim().replace(/\s+/g, " ")
      : null,
    eligibility: command.eligibility || null,
    enrollmentId: command.enrollmentId,
    operation,
    responsibleRelationshipId:
      command.responsibleRelationshipId || null,
    reviewerAuthIdentityId:
      command.reviewerAuthIdentityId || null,
    revision: command.revision || null,
  };

  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

function toDto(review) {
  return Object.freeze({
    canResubmit:
      review.status === REVIEW_STATUSES.CORRECTION_REQUESTED,
    correctionItems: Object.freeze([...review.correctionItems]),
    decidedAt: review.decidedAt,
    decisionCode: review.decisionCode,
    enrollmentId: review.enrollmentId,
    reviewId: review.id,
    reviewRound: review.reviewRound,
    revision: review.revision,
    status: review.status,
    submittedAt: review.submittedAt,
  });
}

function required(value, field) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw invalid(`${field} is required.`);
  }

  return normalized;
}

function dependencyUnavailable() {
  const error = new Error(
    "Digital enrollment administrative review is not configured.",
  );

  error.code = "DIGITAL_ENROLLMENT_REVIEW_NOT_CONFIGURED";
  error.statusCode = 503;
  error.expose = false;

  return error;
}

module.exports = {
  DigitalEnrollmentAdministrativeReviewService,
  dependencyUnavailable,
  fingerprint,
  toDto,
};