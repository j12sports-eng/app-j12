const { normalizeCanonicalUnitId } = require("../../domain/entities/enrollment.entity.js");

const ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE = "ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED";

function readTrustedEnrollmentContext(request = {}) {
  const actorContext =
    request?.actorContext &&
    typeof request.actorContext === "object" &&
    !Array.isArray(request.actorContext)
      ? request.actorContext
      : null;

  let unitId = null;
  try {
    unitId = normalizeCanonicalUnitId(actorContext?.unitContext?.unitId, {
      nullable: true,
    });
  } catch {
    unitId = null;
  }

  if (!unitId) {
    const error = new Error("Trusted Enrollment unit context is required.");
    error.code = ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE;
    error.expose = true;
    error.statusCode = 403;
    throw error;
  }

  return Object.freeze({ unitId });
}

module.exports = {
  ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE,
  readTrustedEnrollmentContext,
};
