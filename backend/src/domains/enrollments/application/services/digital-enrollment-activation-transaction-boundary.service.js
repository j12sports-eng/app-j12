const {
  DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
} = require("./evaluate-digital-enrollment-activation-readiness.service.js");

const DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_FORBIDDEN =
  "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_FORBIDDEN";
const DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_INVALID_COMMAND =
  "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_INVALID_COMMAND";
const DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED =
  "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED";
const DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_UNSAFE_RESULT =
  "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_UNSAFE_RESULT";

const COMMAND_FIELDS = new Set([
  "actorAuthIdentityId",
  "commandId",
  "correlationId",
  "enrollmentId",
  "responsibleRelationshipId",
]);

/**
 * Represents the future activation transaction boundary without opening a
 * transaction or exposing any persistence/downstream collaborator.
 */
class DigitalEnrollmentActivationTransactionBoundaryService {
  constructor({ activationExecutor = null, authorizationPolicy = null, logger = null } = {}) {
    Object.assign(this, {
      activationExecutor,
      authorizationPolicy,
      logger,
    });
  }

  async execute(command = {}) {
    const input = validateCommand(command);
    await this.authorize(input);

    if (typeof this.activationExecutor?.execute !== "function") {
      throw notConfigured();
    }

    const executorResult = await this.activationExecutor.execute(input);
    assertSafeResult(executorResult, input.enrollmentId);

    const result = Object.freeze({
      activationAllowed: false,
      activationAttempted: true,
      activationExecuted: false,
      blocker: DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
      enrollmentId: input.enrollmentId,
      enrollmentStatus: "DRAFT",
      result: "BLOCKED",
    });

    this.logger?.info?.("[enrollments] digital activation transaction boundary blocked", {
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
          action: "ENTER_DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY",
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

function assertSafeResult(result, enrollmentId) {
  if (
    !result ||
    result.activationAllowed !== false ||
    result.activationExecuted !== false ||
    result.blocker !== DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE ||
    result.result !== "BLOCKED" ||
    result.enrollmentId !== enrollmentId ||
    result.enrollmentStatus !== "DRAFT"
  ) {
    throw unsafeResult();
  }
}

function invalidCommand() {
  return controlledError(
    "Digital enrollment activation transaction boundary command is invalid.",
    DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_INVALID_COMMAND,
    400,
  );
}

function notConfigured() {
  return controlledError(
    "Digital enrollment activation transaction boundary is not configured.",
    DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED,
    503,
    false,
  );
}

function forbidden() {
  return controlledError(
    "Digital enrollment activation transaction boundary is forbidden.",
    DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_FORBIDDEN,
    403,
  );
}

function unsafeResult() {
  return controlledError(
    "Activation executor returned an unsafe result.",
    DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_UNSAFE_RESULT,
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
  DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_FORBIDDEN,
  DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_INVALID_COMMAND,
  DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_UNSAFE_RESULT,
  DigitalEnrollmentActivationTransactionBoundaryService,
};
