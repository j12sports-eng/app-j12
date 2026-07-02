const EnrollmentStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  DRAFT: "DRAFT",
  FINISHED: "FINISHED",
  PENDING: "PENDING",
  SUSPENDED: "SUSPENDED",
});

const ENROLLMENT_STATUS_VALUES = Object.freeze(Object.values(EnrollmentStatus));

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeEnrollmentStatus(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return ENROLLMENT_STATUS_VALUES.includes(normalized) ? normalized : null;
}

module.exports = {
  ENROLLMENT_STATUS_VALUES,
  EnrollmentStatus,
  normalizeEnrollmentStatus,
};
