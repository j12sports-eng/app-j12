const { PersonRelationship } = require("./relationship.entity.js");
const { PERSON_RELATIONSHIP_STATUS } = require("./relationship.types.js");

/**
 * Maps plain data into a PersonRelationship entity.
 *
 * @param {import("./relationship.types.js").PersonRelationshipData} [data]
 * @returns {PersonRelationship}
 */
function toPersonRelationshipEntity(data = {}) {
  return new PersonRelationship(data);
}

/**
 * Maps a PersonRelationship entity or plain data into a DTO.
 *
 * @param {PersonRelationship|import("./relationship.types.js").PersonRelationshipData|null|undefined} relationship
 * @returns {import("./relationship.types.js").PersonRelationshipData}
 */
function toPersonRelationshipData(relationship) {
  if (relationship instanceof PersonRelationship) {
    return relationship.toJSON();
  }

  return new PersonRelationship(relationship || {}).toJSON();
}

/**
 * Maps a database row from `person_relationships` into domain data.
 *
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {import("./relationship.types.js").PersonRelationshipData|null}
 */
function toPersonRelationshipDataFromRow(row) {
  if (!row) return null;

  return toPersonRelationshipData({
    canPickUp: normalizeBoolean(row.can_pick_up),
    createdAt: row.created_at ?? null,
    emergencyContact: normalizeBoolean(row.emergency_contact),
    financialResponsible: normalizeBoolean(row.financial_responsible),
    id: row.id ?? null,
    legalGuardian: normalizeBoolean(row.legal_guardian),
    personId: row.person_id ?? null,
    priority: normalizePriority(row.priority),
    receivesNotifications: normalizeBoolean(row.receives_notifications),
    relatedPersonId: row.related_person_id ?? null,
    relationshipLabel: row.relationship_label ?? null,
    relationshipType: row.relationship_type ?? null,
    status: row.status ?? PERSON_RELATIONSHIP_STATUS.ACTIVE,
    updatedAt: row.updated_at ?? null,
    validFrom: row.valid_from ?? null,
    validUntil: row.valid_until ?? null,
  });
}

/**
 * Maps relationship data into `person_relationships` column values.
 *
 * @param {import("./relationship.types.js").PersonRelationshipData} data
 * @returns {Record<string, unknown>}
 */
function toPersonRelationshipRowValues(data) {
  const relationship = toPersonRelationshipData(data);

  return {
    can_pick_up: relationship.canPickUp ? 1 : 0,
    emergency_contact: relationship.emergencyContact ? 1 : 0,
    financial_responsible: relationship.financialResponsible ? 1 : 0,
    id: nullableText(relationship.id, 64),
    legal_guardian: relationship.legalGuardian ? 1 : 0,
    person_id: text(relationship.personId, 64),
    priority: normalizePriority(relationship.priority),
    receives_notifications: relationship.receivesNotifications ? 1 : 0,
    related_person_id: text(relationship.relatedPersonId, 64),
    relationship_label: nullableText(relationship.relationshipLabel, 100),
    relationship_type: text(relationship.relationshipType, 50).toLowerCase(),
    status: text(relationship.status || PERSON_RELATIONSHIP_STATUS.ACTIVE, 30).toLowerCase(),
    valid_from: nullableDate(relationship.validFrom),
    valid_until: nullableDate(relationship.validUntil),
  };
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
 * @returns {number|null}
 */
function normalizePriority(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.trunc(parsed);
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableDate(value) {
  return nullableText(value, 10);
}

module.exports = {
  normalizeBoolean,
  normalizePriority,
  toPersonRelationshipData,
  toPersonRelationshipDataFromRow,
  toPersonRelationshipEntity,
  toPersonRelationshipRowValues,
};
