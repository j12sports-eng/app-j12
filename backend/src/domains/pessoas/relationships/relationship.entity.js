const { PERSON_RELATIONSHIP_STATUS } = require("./relationship.types.js");

/**
 * Domain entity for an isolated relationship between two Pessoas.
 *
 * This entity models shared relationship flags only. It has no dependency on
 * aluno, responsavel, auth, financeiro, dashboard, routes or APIs.
 */
class PersonRelationship {
  /**
   * @param {import("./relationship.types.js").PersonRelationshipData} [data]
   */
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.personId = data.personId ?? null;
    this.relatedPersonId = data.relatedPersonId ?? null;
    this.relationshipType = normalizeLowerText(data.relationshipType);
    this.relationshipLabel = data.relationshipLabel ?? null;
    this.priority = normalizePriority(data.priority);
    this.receivesNotifications = normalizeBoolean(data.receivesNotifications);
    this.financialResponsible = normalizeBoolean(data.financialResponsible);
    this.canPickUp = normalizeBoolean(data.canPickUp);
    this.emergencyContact = normalizeBoolean(data.emergencyContact);
    this.legalGuardian = normalizeBoolean(data.legalGuardian);
    this.status = normalizeLowerText(data.status) ?? PERSON_RELATIONSHIP_STATUS.ACTIVE;
    this.validFrom = data.validFrom ?? null;
    this.validUntil = data.validUntil ?? null;
    this.createdAt = data.createdAt ?? null;
    this.updatedAt = data.updatedAt ?? null;
  }

  /**
   * Returns a plain object representation for persistence and future adapters.
   *
   * @returns {import("./relationship.types.js").PersonRelationshipData}
   */
  toJSON() {
    return {
      canPickUp: this.canPickUp,
      createdAt: this.createdAt,
      emergencyContact: this.emergencyContact,
      financialResponsible: this.financialResponsible,
      id: this.id,
      legalGuardian: this.legalGuardian,
      personId: this.personId,
      priority: this.priority,
      receivesNotifications: this.receivesNotifications,
      relatedPersonId: this.relatedPersonId,
      relationshipLabel: this.relationshipLabel,
      relationshipType: this.relationshipType,
      status: this.status,
      updatedAt: this.updatedAt,
      validFrom: this.validFrom,
      validUntil: this.validUntil,
    };
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1";
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeLowerText(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.toLowerCase() : null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizePriority(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.trunc(parsed);
}

module.exports = {
  PersonRelationship,
  normalizeBoolean,
  normalizeLowerText,
  normalizePriority,
};
