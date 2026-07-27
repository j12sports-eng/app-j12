const {
  DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
} = require("./evaluate-digital-enrollment-activation-readiness.service.js");

const DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_FORBIDDEN =
  "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_FORBIDDEN";
const DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND =
  "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND";
const DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED =
  "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED";
const DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_FOUND =
  "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_FOUND";

const COMMAND_FIELDS = new Set(["actorAuthIdentityId", "enrollmentId", "evidence"]);
const EVIDENCE_FIELDS = new Set([
  "administrativeReviewStatus",
  "contractAccepted",
  "documentsComplete",
  "progressStatus",
  "workflowStatus",
]);

/**
 * Prepares and records a blocked activation attempt. This application service
 * intentionally cannot persist Enrollment or dispatch activation events.
 */
class DigitalEnrollmentActivationOrchestratorService {
  constructor({
    authorizationPolicy = null,
    enrollmentReader = null,
    logger = null,
    readinessService = null,
  } = {}) {
    Object.assign(this, {
      authorizationPolicy,
      enrollmentReader,
      logger,
      readinessService,
    });
  }

  async activate(command = {}) {
    const input = validateCommand(command);
    await this.authorize(input.actorAuthIdentityId);

    const enrollment = await this.loadEnrollment(input.enrollmentId);
    const enrollmentStatus = readText(enrollment, "status");
    const readiness = this.evaluateReadiness({
      ...input.evidence,
      enrollmentStatus,
    });
    const attempt = toAttemptDto({
      enrollmentId: input.enrollmentId,
      enrollmentStatus,
      readiness,
    });

    this.logAttempt(attempt);
    return attempt;
  }

  async authorize(actorAuthIdentityId) {
    if (typeof this.authorizationPolicy?.authorize !== "function") {
      throw notConfigured();
    }

    let result = null;
    try {
      result = await this.authorizationPolicy.authorize({
        action: "ATTEMPT_DIGITAL_ENROLLMENT_ACTIVATION",
        actorAuthIdentityId,
      });
    } catch {
      throw forbidden();
    }

    if (result !== true && result?.authorized !== true) {
      throw forbidden();
    }
  }

  async loadEnrollment(enrollmentId) {
    let enrollment = null;
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

  evaluateReadiness(evidence) {
    if (typeof this.readinessService?.execute !== "function") {
      throw notConfigured();
    }

    const result = this.readinessService.execute(Object.freeze({ ...evidence }));
    if (
      !result ||
      typeof result.ready !== "boolean" ||
      result.activationAllowed !== false ||
      result.operationalBlocker !== DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE ||
      !Array.isArray(result.blockers)
    ) {
      throw notConfigured();
    }
    return result;
  }

  logAttempt(attempt) {
    this.logger?.info?.("[enrollments] digital activation attempt blocked", {
      blocker: attempt.blocker,
      enrollmentId: attempt.enrollmentId,
      functionalReady: attempt.functionalReady,
      result: attempt.result,
    });
  }
}

function validateCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw invalidCommand();
  }

  const unexpectedCommandFields = Object.keys(command).filter(
    (field) => !COMMAND_FIELDS.has(field),
  );
  const evidence =
    command.evidence && typeof command.evidence === "object" && !Array.isArray(command.evidence)
      ? command.evidence
      : null;
  const unexpectedEvidenceFields = evidence
    ? Object.keys(evidence).filter((field) => !EVIDENCE_FIELDS.has(field))
    : [];
  const actorAuthIdentityId = normalizedIdentifier(command.actorAuthIdentityId, 191);
  const enrollmentId = normalizedIdentifier(command.enrollmentId, 64);

  if (
    unexpectedCommandFields.length > 0 ||
    unexpectedEvidenceFields.length > 0 ||
    !evidence ||
    !actorAuthIdentityId ||
    !enrollmentId ||
    !isValidIdentifier(enrollmentId)
  ) {
    throw invalidCommand();
  }

  return Object.freeze({
    actorAuthIdentityId,
    enrollmentId,
    evidence: Object.freeze({
      administrativeReviewStatus: evidence.administrativeReviewStatus,
      contractAccepted: evidence.contractAccepted,
      documentsComplete: evidence.documentsComplete,
      progressStatus: evidence.progressStatus,
      workflowStatus: evidence.workflowStatus,
    }),
  });
}

function toAttemptDto({ enrollmentId, enrollmentStatus, readiness }) {
  return Object.freeze({
    activationAllowed: false,
    attemptRecorded: true,
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
    enrollmentId,
    enrollmentStatus,
    functionalBlockers: Object.freeze([...readiness.blockers]),
    functionalReady: readiness.ready === true,
    result: "BLOCKED",
  });
}

function normalizedIdentifier(value, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function isValidIdentifier(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
}

function readText(value, property) {
  const normalized = String(value?.[property] ?? "").trim();
  return normalized || null;
}

function invalidCommand() {
  return controlledError(
    "Digital enrollment activation command is invalid.",
    DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND,
    400,
  );
}

function forbidden() {
  return controlledError(
    "Digital enrollment activation attempt is forbidden.",
    DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_FORBIDDEN,
    403,
  );
}

function notConfigured() {
  return controlledError(
    "Digital enrollment activation orchestrator is not configured.",
    DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED,
    503,
    false,
  );
}

function notFound() {
  return controlledError(
    "Enrollment was not found for activation readiness.",
    DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_FOUND,
    404,
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
  DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_FORBIDDEN,
  DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND,
  DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_FOUND,
  DigitalEnrollmentActivationOrchestratorService,
};
