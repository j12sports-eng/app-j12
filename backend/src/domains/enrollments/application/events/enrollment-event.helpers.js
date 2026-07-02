/**
 * @param {unknown} value
 * @param {string} property
 * @returns {unknown|null}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

/**
 * @param {unknown} enrollment
 * @returns {{ enrollmentId: string|null, studentPersonId: string|null, studentProfileId: string|null, status: string|null }}
 */
function readEnrollmentEventData(enrollment = null) {
  return {
    enrollmentId: nullableText(readProperty(enrollment, "id"), 64),
    status: nullableText(readProperty(enrollment, "status"), 32),
    studentPersonId: nullableText(
      readProperty(enrollment, "studentPersonId") || readProperty(enrollment, "student_person_id"),
      64,
    ),
    studentProfileId: nullableText(
      readProperty(enrollment, "studentProfileId") || readProperty(enrollment, "student_profile_id"),
      64,
    ),
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeEventMetadata(input = {}) {
  const metadata = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const normalized = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey) {
      continue;
    }

    if (value === null || ["boolean", "number", "string"].includes(typeof value)) {
      normalized[normalizedKey] = typeof value === "string" ? nullableText(value, 191) : value;
    }
  }

  return {
    externalIntegrationsTriggered: false,
    internal: true,
    ...normalized,
  };
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  normalizeEventMetadata,
  nullableText,
  readEnrollmentEventData,
};
