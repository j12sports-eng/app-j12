const PERSON_RELATIONSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  BLOCKED: "blocked",
  ENDED: "ended",
  INACTIVE: "inactive",
  PENDING: "pending",
});

const PERSON_RELATIONSHIP_TYPE = Object.freeze({
  AUTHORIZED_PICKUP: "authorized_pickup",
  COMMUNICATION: "communication",
  EMERGENCY: "emergency",
  FAMILY: "family",
  FINANCIAL: "financial",
  LEGAL: "legal",
  OTHER: "other",
  RESPONSIBLE: "responsible",
});

const PERSON_RELATIONSHIP_STATUS_VALUES = Object.freeze(Object.values(PERSON_RELATIONSHIP_STATUS));
const PERSON_RELATIONSHIP_TYPE_VALUES = Object.freeze(Object.values(PERSON_RELATIONSHIP_TYPE));

/**
 * @typedef {Object} PersonRelationshipData
 * @property {string|null} [id]
 * @property {string|null} [personId]
 * @property {string|null} [relatedPersonId]
 * @property {string|null} [relationshipType]
 * @property {string|null} [relationshipLabel]
 * @property {number|null} [priority]
 * @property {boolean} [receivesNotifications]
 * @property {boolean} [financialResponsible]
 * @property {boolean} [canPickUp]
 * @property {boolean} [emergencyContact]
 * @property {boolean} [legalGuardian]
 * @property {string|null} [status]
 * @property {string|null} [validFrom]
 * @property {string|null} [validUntil]
 * @property {string|null} [createdAt]
 * @property {string|null} [updatedAt]
 */

module.exports = {
  PERSON_RELATIONSHIP_STATUS,
  PERSON_RELATIONSHIP_STATUS_VALUES,
  PERSON_RELATIONSHIP_TYPE,
  PERSON_RELATIONSHIP_TYPE_VALUES,
};
