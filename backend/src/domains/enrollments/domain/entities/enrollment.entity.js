const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../enums/enrollment-status.enum.js");

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
      updatedAt: this.updatedAt,
    };
  }
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
  Enrollment,
  nullableText,
};
