const {
  DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
} = require("./evaluate-digital-enrollment-activation-readiness.service.js");

const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_FORBIDDEN =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_FORBIDDEN";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_INVALID_COMMAND =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_INVALID_COMMAND";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_FOUND =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_FOUND";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_OWNERSHIP_CONFLICT =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_OWNERSHIP_CONFLICT";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_STATE_CONFLICT =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_STATE_CONFLICT";
const DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_UNSAFE_RESULT =
  "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_UNSAFE_RESULT";

const COMMAND_FIELDS = new Set([
  "actorAuthIdentityId",
  "commandId",
  "correlationId",
  "enrollmentId",
  "responsibleRelationshipId",
]);

/**
 * Executes the safe activation boundary. It deliberately has no writer or
 * operational collaborator and can only return the canonical blocked result.
 */
class DigitalEnrollmentActivationExecutorService {
  constructor({
    activationOrchestrator = null,
    authorizationPolicy = null,
    enrollmentReader = null,
    logger = null,
  } = {}) {
    Object.assign(this, {
      activationOrchestrator,
      authorizationPolicy,
      enrollmentReader,
      logger,
    });
  }

  async execute(command = {}) {
    const input = validateCommand(command);
    await this.authorize(input);

    const enrollment = await this.loadEnrollment(input.enrollmentId);
    this.assertOwnership(enrollment, input.responsibleRelationshipId);
    this.assertDraft(enrollment);

    const orchestrated = await this.orchestrate(input, enrollment);
    assertSafeResult(orchestrated);

    const result = Object.freeze({
      activationAllowed: false,
      activationAttempted: true,
      activationExecuted: false,
      blocker: DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
      enrollmentId: input.enrollmentId,
      enrollmentStatus: "DRAFT",
      result: "BLOCKED",
    });

    this.logger?.info?.("[enrollments] digital activation execution blocked", {
      blocker: result.blocker,
      enrollmentId: result.enrollmentId,
      result: result.result,
    });
    return result;
  }

  async authorize(input) {
    if (typeof this.authorizationPolicy?.authorize !== "function") {
      throw notConfigured();
    }

    let authorization;
    try {
      authorization = await this.authorizationPolicy.authorize(
        Object.freeze({
          action: "EXECUTE_DIGITAL_ENROLLMENT_ACTIVATION",
          actorAuthIdentityId: input.actorAuthIdentityId,
          enrollmentId: input.enrollmentId,
          responsibleRelationshipId: input.responsibleRelationshipId,
        }),
      );
    } catch {
      throw forbidden();
    }

    if (authorization !== true && authorization?.authorized !== true) {
      throw forbidden();
    }
  }

  async loadEnrollment(enrollmentId) {
    let enrollment;
    if (typeof this.enrollmentReader?.findById === "function") {
      enrollment = await this.enrollmentReader.findById(enrollmentId);
    } else if (typeof this.enrollmentReader?.findEnrollmentById === "function") {
      enrollment = await this.enrollmentReader.findEnrollmentById(enrollmentId);
    } else {
      throw notConfigured();
    }

    if (!enrollment) {
      throw notFound();
    }
    return enrollment;
  }

  assertOwnership(enrollment, responsibleRelationshipId) {
    if (readIdentifier(enrollment, "responsibleRelationshipId") !== responsibleRelationshipId) {
      throw ownershipConflict();
    }
  }

  assertDraft(enrollment) {
    if (String(enrollment?.status ?? "").trim() !== "DRAFT") {
      throw stateConflict();
    }
  }

  async orchestrate(input, enrollment) {
    if (typeof this.activationOrchestrator?.activate !== "function") {
      throw notConfigured();
    }

    return this.activationOrchestrator.activate(
      Object.freeze({
        actorAuthIdentityId: input.actorAuthIdentityId,
        enrollmentId: input.enrollmentId,
        evidence: Object.freeze({
          administrativeReviewStatus: enrollment.administrativeReviewStatus,
          contractAccepted: enrollment.contractAccepted,
          documentsComplete: enrollment.documentsComplete,
          progressStatus: enrollment.progressStatus,
          workflowStatus: enrollment.workflowStatus,
        }),
      }),
    );
  }
}

function validateCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw invalidCommand();
  }

  if (Object.keys(command).some((field) => !COMMAND_FIELDS.has(field))) {
    throw invalidCommand();
  }

  const input = {
    actorAuthIdentityId: normalizeIdentifier(command.actorAuthIdentityId, 191),
    commandId: normalizeOptionalIdentifier(command.commandId, 64),
    correlationId: normalizeOptionalIdentifier(command.correlationId, 64),
    enrollmentId: normalizeIdentifier(command.enrollmentId, 64),
    responsibleRelationshipId: normalizeIdentifier(command.responsibleRelationshipId, 64),
  };
  if (
    !input.actorAuthIdentityId ||
    !input.enrollmentId ||
    !input.responsibleRelationshipId ||
    input.commandId === false ||
    input.correlationId === false
  ) {
    throw invalidCommand();
  }
  return Object.freeze(input);
}

function normalizeIdentifier(value, maxLength) {
  const normalized = String(value ?? "").trim();
  return normalized &&
    normalized.length <= maxLength &&
    /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(normalized)
    ? normalized
    : null;
}

function normalizeOptionalIdentifier(value, maxLength) {
  if (value === undefined) {
    return null;
  }
  return normalizeIdentifier(value, maxLength) || false;
}

function readIdentifier(value, property) {
  return String(value?.[property] ?? "").trim() || null;
}

function assertSafeResult(result) {
  if (
    !result ||
    result.activationAllowed !== false ||
    result.activationExecuted !== false ||
    result.blocker !== DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE
  ) {
    throw unsafeResult();
  }
}

function invalidCommand() {
  return controlledError(
    "Digital enrollment activation executor command is invalid.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_INVALID_COMMAND,
    400,
  );
}

function notConfigured() {
  return controlledError(
    "Digital enrollment activation executor is not configured.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED,
    503,
    false,
  );
}

function forbidden() {
  return controlledError(
    "Digital enrollment activation execution is forbidden.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_FORBIDDEN,
    403,
  );
}

function notFound() {
  return controlledError(
    "Enrollment was not found for activation execution.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_FOUND,
    404,
  );
}

function ownershipConflict() {
  return controlledError(
    "Enrollment ownership does not match the activation command.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_OWNERSHIP_CONFLICT,
    409,
  );
}

function stateConflict() {
  return controlledError(
    "Enrollment is not in DRAFT state.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_STATE_CONFLICT,
    409,
  );
}

function unsafeResult() {
  return controlledError(
    "Activation orchestrator returned an unsafe result.",
    DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_UNSAFE_RESULT,
    503,
    false,
  );
}

function controlledError(message, code, statusCode, expose = true) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_FORBIDDEN,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_INVALID_COMMAND,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_FOUND,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_OWNERSHIP_CONFLICT,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_STATE_CONFLICT,
  DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_UNSAFE_RESULT,
  DigitalEnrollmentActivationExecutorService,
};
