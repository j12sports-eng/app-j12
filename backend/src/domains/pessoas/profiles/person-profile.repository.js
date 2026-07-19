const { randomUUID } = require("node:crypto");

const {
  toPersonProfileDataFromRow,
  toPersonProfileRowValues,
} = require("./person-profile.mapper.js");

const TABLE_NAME = "person_profiles";

const CREATE_PERSON_PROFILES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS person_profiles (
    id VARCHAR(64) PRIMARY KEY,
    person_id VARCHAR(64) NOT NULL,
    profile_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_person_profiles_person (person_id),
    INDEX idx_person_profiles_type (profile_type),
    INDEX idx_person_profiles_status (status),
    UNIQUE INDEX ux_person_profiles_person_type (person_id, profile_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const UPDATE_COLUMN_MAP = Object.freeze({
  person_id: "person_id",
  profile_type: "profile_type",
  status: "status",
});

/**
 * Repository for the isolated Person Profile persistence layer.
 *
 * This repository only touches `person_profiles`. It does not query Pessoa,
 * aluno, responsavel, auth, dashboard, financeiro or login tables.
 */
class PersonProfileRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * Creates the independent `person_profiles` table when it does not exist.
   *
   * @returns {Promise<void>}
   */
  async ensureTable() {
    await this.query(CREATE_PERSON_PROFILES_TABLE_SQL);
  }

  /**
   * Verifies database access without changing data.
   *
   * @returns {Promise<boolean>}
   */
  async ping() {
    const rows = await this.query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows[0]?.ok === 1;
  }

  /**
   * Creates a Person Profile row.
   *
   * @param {import("./person-profile.mapper.js").PersonProfileData} data
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData|null>}
   */
  async create(data) {
    const id = data.id || randomUUID();
    const values = toPersonProfileRowValues({ ...data, id });

    await this.query(
      `
        INSERT INTO ${TABLE_NAME} (
          id,
          person_id,
          profile_type,
          status
        )
        VALUES (?, ?, ?, ?)
      `,
      [id, values.person_id, values.profile_type, values.status],
    );

    return this.findById(id);
  }

  /**
   * Finds a Person Profile by id.
   *
   * @param {string} id
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData|null>}
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

    return toPersonProfileDataFromRow(Array.isArray(rows) ? rows[0] : null);
  }

  /** Returns at most two matching profiles so the application layer can detect conflicts. */
  async findCandidatesByPersonAndType(personId, profileType) {
    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE person_id = ? AND profile_type = ?
        ORDER BY created_at ASC, id ASC
        LIMIT 2
      `,
      [personId, profileType],
    );
    return Array.isArray(rows) ? rows.map(toPersonProfileDataFromRow).filter(Boolean) : [];
  }

  /**
   * Lists Person Profiles with optional filters.
   *
   * @param {Object} [filters]
   * @param {string} [filters.personId]
   * @param {string} [filters.profileType]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData[]>}
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

    if (filters.profileType) {
      where.push("profile_type = ?");
      params.push(String(filters.profileType).trim().toLowerCase());
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

    return Array.isArray(rows) ? rows.map(toPersonProfileDataFromRow).filter(Boolean) : [];
  }

  /**
   * Updates a Person Profile row with full mapped data.
   *
   * @param {string} id
   * @param {import("./person-profile.mapper.js").PersonProfileData} data
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData|null>}
   */
  async update(id, data) {
    const values = toPersonProfileRowValues({ ...data, id });
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
   * Deletes a Person Profile row.
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
  CREATE_PERSON_PROFILES_TABLE_SQL,
  PERSON_PROFILES_TABLE_NAME: TABLE_NAME,
  PersonProfileRepository,
};
