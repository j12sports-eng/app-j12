const { randomUUID } = require("node:crypto");

const {
  toPersonRelationshipDataFromRow,
  toPersonRelationshipRowValues,
} = require("./relationship.mapper.js");

const TABLE_NAME = "person_relationships";

const CREATE_PERSON_RELATIONSHIPS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS person_relationships (
    id VARCHAR(64) PRIMARY KEY,
    person_id VARCHAR(64) NOT NULL,
    related_person_id VARCHAR(64) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    relationship_label VARCHAR(100) NULL,
    priority INT NULL,
    receives_notifications TINYINT(1) NOT NULL DEFAULT 0,
    financial_responsible TINYINT(1) NOT NULL DEFAULT 0,
    can_pick_up TINYINT(1) NOT NULL DEFAULT 0,
    emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
    legal_guardian TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    valid_from DATE NULL,
    valid_until DATE NULL,
    active_person_id VARCHAR(64) GENERATED ALWAYS AS (
      CASE WHEN status = 'active' THEN person_id ELSE NULL END
    ) VIRTUAL,
    active_related_person_id VARCHAR(64) GENERATED ALWAYS AS (
      CASE WHEN status = 'active' THEN related_person_id ELSE NULL END
    ) VIRTUAL,
    active_relationship_type VARCHAR(50) GENERATED ALWAYS AS (
      CASE WHEN status = 'active' THEN relationship_type ELSE NULL END
    ) VIRTUAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_person_relationships_person (person_id),
    INDEX idx_person_relationships_related_person (related_person_id),
    INDEX idx_person_relationships_type (relationship_type),
    INDEX idx_person_relationships_status (status),
    UNIQUE INDEX ux_person_relationships_active_structure (
      active_person_id,
      active_related_person_id,
      active_relationship_type
    )
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const UPDATE_COLUMN_MAP = Object.freeze({
  can_pick_up: "can_pick_up",
  emergency_contact: "emergency_contact",
  financial_responsible: "financial_responsible",
  legal_guardian: "legal_guardian",
  person_id: "person_id",
  priority: "priority",
  receives_notifications: "receives_notifications",
  related_person_id: "related_person_id",
  relationship_label: "relationship_label",
  relationship_type: "relationship_type",
  status: "status",
  valid_from: "valid_from",
  valid_until: "valid_until",
});

/**
 * Repository for the isolated Person Relationships persistence layer.
 *
 * This repository only touches `person_relationships`. It does not query or
 * mutate aluno, responsavel, auth, dashboard, financeiro, frontend or routes.
 */
class PersonRelationshipRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * Creates the independent `person_relationships` table when missing.
   *
   * @returns {Promise<void>}
   */
  async ensureTable() {
    await this.query(CREATE_PERSON_RELATIONSHIPS_TABLE_SQL);
  }

  /**
   * Verifies database access without mutating data.
   *
   * @returns {Promise<boolean>}
   */
  async ping() {
    const rows = await this.query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows[0]?.ok === 1;
  }

  /**
   * Creates a person relationship row.
   *
   * @param {import("./relationship.types.js").PersonRelationshipData} data
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData|null>}
   */
  async create(data) {
    const id = data.id || randomUUID();
    const values = toPersonRelationshipRowValues({ ...data, id });

    await this.query(
      `
        INSERT INTO ${TABLE_NAME} (
          id,
          person_id,
          related_person_id,
          relationship_type,
          relationship_label,
          priority,
          receives_notifications,
          financial_responsible,
          can_pick_up,
          emergency_contact,
          legal_guardian,
          status,
          valid_from,
          valid_until
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        values.person_id,
        values.related_person_id,
        values.relationship_type,
        values.relationship_label,
        values.priority,
        values.receives_notifications,
        values.financial_responsible,
        values.can_pick_up,
        values.emergency_contact,
        values.legal_guardian,
        values.status,
        values.valid_from,
        values.valid_until,
      ],
    );

    return this.findById(id);
  }

  /**
   * Finds a relationship by id.
   *
   * @param {string} id
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData|null>}
   */
  async findById(id) {
    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    return toPersonRelationshipDataFromRow(Array.isArray(rows) ? rows[0] : null);
  }

  /** Returns at most two matches so the application layer can detect conflicts. */
  async findCandidatesByPeopleAndType(personId, relatedPersonId, relationshipType) {
    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE person_id = ?
          AND related_person_id = ?
          AND relationship_type = ?
          AND status = 'active'
        ORDER BY created_at ASC, id ASC
        LIMIT 2
      `,
      [personId, relatedPersonId, relationshipType],
    );

    return Array.isArray(rows) ? rows.map(toPersonRelationshipDataFromRow).filter(Boolean) : [];
  }

  /**
   * Lists relationships with optional filters.
   *
   * @param {Object} [filters]
   * @param {string} [filters.personId]
   * @param {string} [filters.relatedPersonId]
   * @param {string} [filters.relationshipType]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData[]>}
   */
  async list(filters = {}) {
    const params = [];
    const where = [];
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    if (filters.personId) {
      where.push("person_id = ?");
      params.push(String(filters.personId).trim());
    }

    if (filters.relatedPersonId) {
      where.push("related_person_id = ?");
      params.push(String(filters.relatedPersonId).trim());
    }

    if (filters.relationshipType) {
      where.push("relationship_type = ?");
      params.push(String(filters.relationshipType).trim().toLowerCase());
    }

    if (filters.status) {
      where.push("status = ?");
      params.push(String(filters.status).trim().toLowerCase());
    }

    params.push(limit, offset);

    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        OFFSET ?
      `,
      params,
    );

    return Array.isArray(rows) ? rows.map(toPersonRelationshipDataFromRow).filter(Boolean) : [];
  }

  /**
   * Updates a relationship row with full mapped data.
   *
   * @param {string} id
   * @param {import("./relationship.types.js").PersonRelationshipData} data
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData|null>}
   */
  async update(id, data) {
    const values = toPersonRelationshipRowValues({ ...data, id });
    const assignments = [];
    const params = [];

    for (const [key, column] of Object.entries(UPDATE_COLUMN_MAP)) {
      assignments.push(`${column} = ?`);
      params.push(values[key]);
    }

    params.push(id);

    const result = await this.query(
      `
        UPDATE ${TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      params,
    );

    if (!result || result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Deletes a relationship row.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    return Boolean(result && result.affectedRows > 0);
  }
}

/**
 * Loads the current mysql2 query wrapper lazily.
 *
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../config/db.js").query;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.trunc(parsed), 200);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

module.exports = {
  CREATE_PERSON_RELATIONSHIPS_TABLE_SQL,
  PERSON_RELATIONSHIPS_TABLE_NAME: TABLE_NAME,
  PersonRelationshipRepository,
};
