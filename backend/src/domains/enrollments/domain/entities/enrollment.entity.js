const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../enums/enrollment-status.enum.js");

const CANONICAL_UNIT_ID_PATTERN = /^[1-9][0-9]{0,19}$/;

/**
 * Aggregate Root for the Enrollment domain.
 *
 * This entity is intentionally persistence-free. It does not access database,
 * SQL, Prisma, APIs, routes, controllers or legacy modules.
 */
class Enrollment {
  /**
   * @param {Object} [data]
   * @param {string|null} [data.id]
   * @param {string|null} [data.unitId]
   * @param {string|null} [data.studentPersonId]
   * @param {string|null} [data.studentProfileId]
   * @param {string|null} [data.status]
   * @param {string|null} [data.startDate]
   * @param {string|null} [data.endDate]
   * @param {string|null} [data.createdAt]
   * @param {string|null} [data.updatedAt]
   */
  constructor(data = {}) {
    this.id = nullableText(data.id);
    // A reconstituiÃ§Ã£o tolera ownership ausente em registros legados.
    // A criaÃ§Ã£o moderna Ã© validada de forma estrita pela EnrollmentFactory.
    this.unitId = normalizeCanonicalUnitId(data.unitId, { nullable: true });
    this.studentPersonId = nullableText(data.studentPersonId);
    this.studentProfileId = nullableText(data.studentProfileId);
    this.status = normalizeEnrollmentStatus(data.status) || EnrollmentStatus.DRAFT;
    this.startDate = nullableText(data.startDate);
    this.endDate = nullableText(data.endDate);
    this.createdAt = nullableText(data.createdAt);
    this.updatedAt = nullableText(data.updatedAt);
  }

  /**
   * @returns {boolean}
   */
  isActive() {
    return this.status === EnrollmentStatus.ACTIVE;
  }

  /**
   * @param {Object} [input]
   * @param {string|null} [input.startDate]
   * @param {string|null} [input.updatedAt]
   * @returns {Enrollment}
   */
  activate({ startDate = null, updatedAt = null } = {}) {
    this.status = EnrollmentStatus.ACTIVE;

    if (startDate !== null && startDate !== undefined) {
      this.startDate = nullableText(startDate);
    }

    this.endDate = null;
    this.touch(updatedAt);

    return this;
  }

  /**
   * @param {Object} [input]
   * @param {string|null} [input.updatedAt]
   * @returns {Enrollment}
   */
  suspend({ updatedAt = null } = {}) {
    this.status = EnrollmentStatus.SUSPENDED;
    this.touch(updatedAt);

    return this;
  }

  /**
   * @param {Object} [input]
   * @param {string|null} [input.endDate]
   * @param {string|null} [input.updatedAt]
   * @returns {Enrollment}
   */
  cancel({ endDate = null, updatedAt = null } = {}) {
    this.status = EnrollmentStatus.CANCELLED;

    if (endDate !== null && endDate !== undefined) {
      this.endDate = nullableText(endDate);
    }

    this.touch(updatedAt);

    return this;
  }

  /**
   * @param {string|null} updatedAt
   * @returns {Enrollment}
   */
  touch(updatedAt = null) {
    if (updatedAt !== null && updatedAt !== undefined) {
      this.updatedAt = nullableText(updatedAt);
    }

    return this;
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      createdAt: this.createdAt,
      endDate: this.endDate,
      id: this.id,
      startDate: this.startDate,
      status: this.status,
      studentPersonId: this.studentPersonId,
      studentProfileId: this.studentProfileId,
      unitId: this.unitId,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Preserva identificadores BIGINT canÃ´nicos como strings decimais exatas.
 *
 * @param {unknown} value
 * @param {{ nullable?: boolean }} [options]
 * @returns {string|null}
 */
function normalizeCanonicalUnitId(value, { nullable = false } = {}) {
  if (value === null || value === undefined) {
    if (nullable) {
      return null;
    }

    throw new TypeError("Enrollment requires unitId.");
  }

  if (typeof value !== "string" || !CANONICAL_UNIT_ID_PATTERN.test(value)) {
    throw new TypeError("Enrollment unitId has an invalid format.");
  }

  return value;
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
  CANONICAL_UNIT_ID_PATTERN,
  Enrollment,
  normalizeCanonicalUnitId,
  nullableText,
};
