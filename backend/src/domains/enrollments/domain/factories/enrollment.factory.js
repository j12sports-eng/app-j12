const { Enrollment, normalizeCanonicalUnitId } = require("../entities/enrollment.entity.js");
const { EnrollmentStatus } = require("../enums/enrollment-status.enum.js");

/**
 * Factory for building Enrollment aggregates in memory.
 *
 * This factory centralizes minimal construction rules only. It does not access
 * repositories, database, Prisma, SQL, APIs, events, routes or legacy modules.
 */
class EnrollmentFactory {
  /**
   * Creates a draft Enrollment aggregate with the minimum safe identifiers.
   *
   * @param {Object} input
   * @param {string|null} [input.id]
   * @param {string} input.studentPersonId
   * @param {string} input.studentProfileId
   * @param {string} input.responsiblePersonId
   * @param {string} input.responsibleProfileId
   * @param {string} input.responsibleRelationshipId
   * @param {string} input.startDate
   * @param {string} input.unitId
   * @param {string|null} [input.createdAt]
   * @param {string|null} [input.updatedAt]
   * @returns {Enrollment}
   */
  static createDraft(input = {}) {
    const draftInput = normalizeCreateDraftInput(input);

    return new Enrollment({
      ...draftInput,
      endDate: null,
      status: EnrollmentStatus.DRAFT,
    });
  }
}

/**
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
function normalizeCreateDraftInput(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    createdAt: nullableText(source.createdAt),
    id: nullableText(source.id),
    responsiblePersonId: requiredText(source.responsiblePersonId, "responsiblePersonId"),
    responsibleProfileId: requiredText(source.responsibleProfileId, "responsibleProfileId"),
    responsibleRelationshipId: requiredText(
      source.responsibleRelationshipId,
      "responsibleRelationshipId",
    ),
    startDate: requiredText(source.startDate, "startDate"),
    studentPersonId: requiredText(source.studentPersonId, "studentPersonId"),
    studentProfileId: requiredText(source.studentProfileId, "studentProfileId"),
    unitId: normalizeCanonicalUnitId(source.unitId),
    updatedAt: nullableText(source.updatedAt),
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requiredText(value, field) {
  const normalized = nullableText(value);

  if (!normalized) {
    throw new TypeError(`EnrollmentFactory.createDraft requires ${field}.`);
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

module.exports = {
  EnrollmentFactory,
  normalizeCreateDraftInput,
  nullableText,
  requiredText,
};
