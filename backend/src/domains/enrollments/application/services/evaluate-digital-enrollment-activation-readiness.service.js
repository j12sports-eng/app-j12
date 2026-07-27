const {
  DigitalEnrollmentActivationReadinessPolicy,
} = require("../../domain/policies/digital-enrollment-activation-readiness.policy.js");

const DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE = "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE";
const DIGITAL_ENROLLMENT_ACTIVATION_READINESS_NOT_CONFIGURED =
  "DIGITAL_ENROLLMENT_ACTIVATION_READINESS_NOT_CONFIGURED";

/**
 * Evaluates readiness only. This service intentionally has no Enrollment
 * writer, financial, class or notification collaborator.
 */
class EvaluateDigitalEnrollmentActivationReadinessService {
  constructor({ policy = new DigitalEnrollmentActivationReadinessPolicy() } = {}) {
    this.policy = policy;
  }

  execute(evidence = {}) {
    if (typeof this.policy?.evaluate !== "function") {
      throw notConfigured();
    }

    const result = this.policy.evaluate(evidence);
    if (!Array.isArray(result?.blockers)) {
      throw notConfigured();
    }

    const blockers = Object.freeze([...result.blockers]);
    return Object.freeze({
      activationAllowed: false,
      blockers,
      operationalBlocker: DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
      ready: result.ready === true && blockers.length === 0,
    });
  }
}

function notConfigured() {
  const error = new Error("Digital enrollment activation readiness is not configured.");
  error.code = DIGITAL_ENROLLMENT_ACTIVATION_READINESS_NOT_CONFIGURED;
  error.statusCode = 503;
  error.expose = false;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
  DIGITAL_ENROLLMENT_ACTIVATION_READINESS_NOT_CONFIGURED,
  EvaluateDigitalEnrollmentActivationReadinessService,
};
