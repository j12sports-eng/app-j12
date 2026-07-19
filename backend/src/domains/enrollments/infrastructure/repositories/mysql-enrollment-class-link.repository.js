const { randomUUID } = require("node:crypto");

const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const TABLE_NAME = "enrollment_class_links";
const ACTIVE_LINK_UNIQUE_INDEX = "ux_enrollment_class_links_active";
const ACTIVE_STATUS = "ACTIVE";
const INACTIVE_STATUS = "INACTIVE";
const LINK_PROJECTION = `
    id,
    enrollment_id,
    class_id,
    status,
    linked_at,
    linked_by,
    unlinked_at,
    unlinked_by,
    origin,
    metadata_json,
    created_at,
    updated_at
`;

const INSERT_ACTIVE_LINK_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    enrollment_id,
    class_id,
    status,
    linked_at,
    linked_by,
    origin,
    metadata_json
  )
  VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
`;

const SELECT_LINK_BY_ID_SQL = `
  SELECT ${LINK_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_ACTIVE_LINK_BY_ENROLLMENT_AND_CLASS_SQL = `
  SELECT ${LINK_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE enrollment_id = ?
    AND class_id = ?
    AND status = ?
    AND unlinked_at IS NULL
  ORDER BY linked_at DESC, id DESC
  LIMIT 1
`;

const SELECT_LATEST_LINK_BY_ENROLLMENT_AND_CLASS_SQL = `
  SELECT ${LINK_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE enrollment_id = ?
    AND class_id = ?
  ORDER BY linked_at DESC, created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_ACTIVE_LINK_COUNT_BY_CLASS_SQL = `
  SELECT COUNT(*) AS active_link_count
  FROM ${TABLE_NAME}
  WHERE class_id = ?
    AND status = ?
    AND unlinked_at IS NULL
`;

const UPDATE_UNLINK_ACTIVE_LINK_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      unlinked_at = COALESCE(?, CURRENT_TIMESTAMP),
      unlinked_by = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE enrollment_id = ?
    AND class_id = ?
    AND status = ?
    AND unlinked_at IS NULL
  LIMIT 1
`;

/**
 * MySQL repository for Enrollment -> Turma link persistence.
 *
 * This adapter only touches `enrollment_class_links`. It does not update
 * j12_turmas, j12_alunos, finance, schedule or notification tables.
 */
class MySqlEnrollmentClassLinkRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * @param {Object} input
   * @param {string|null} input.enrollmentId
   * @param {string|number|null} input.classId
   * @param {string|null} [input.linkedBy]
   * @param {string|null} [input.linkedAt]
   * @param {string|null} [input.origin]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<{ link: Record<string, unknown>|null, created: boolean, reused: boolean }>}
   */
  async createActiveLinkIfNotExists(input = {}) {
    const values = normalizeCreateInput(input);

    try {
      await this.query(INSERT_ACTIVE_LINK_SQL, [
        values.id,
        values.enrollmentId,
        values.classId,
        ACTIVE_STATUS,
        values.linkedAt,
        values.linkedBy,
        values.origin,
        values.metadataJson,
      ]);

      return {
        created: true,
        link: await this.findById(values.id),
        reused: false,
      };
    } catch (error) {
      if (!isActiveLinkDuplicateEntryError(error)) {
        throw error;
      }

      return {
        created: false,
        link: await this.findActiveByEnrollmentAndClass(values),
        reused: true,
      };
    }
  }

  /**
   * Compatibility alias for older service tests/callers. New code should use
   * createActiveLinkIfNotExists to preserve created/reused metadata.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async createOrReuseActiveLink(input = {}) {
    const result = await this.createActiveLinkIfNotExists(input);
    return result.link;
  }

  /**
   * @param {string|number|null} id
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findById(id) {
    const linkId = requiredText(id, "id", 64);
    const rows = await this.query(SELECT_LINK_BY_ID_SQL, [linkId]);

    return toEnrollmentClassLinkData(readFirstRow(rows));
  }

  /**
   * @param {{ enrollmentId?: string|null, classId?: string|number|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findActiveByEnrollmentAndClass(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const classId = requiredInteger(input.classId, "classId");
    const rows = await this.query(SELECT_ACTIVE_LINK_BY_ENROLLMENT_AND_CLASS_SQL, [
      enrollmentId,
      classId,
      ACTIVE_STATUS,
    ]);

    return toEnrollmentClassLinkData(readFirstRow(rows));
  }

  /**
   * Reads the latest state for a pair so callers never silently reactivate or
   * overwrite an incompatible historical link.
   *
   * @param {{ enrollmentId?: string|null, classId?: string|number|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findLatestByEnrollmentAndClass(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const classId = requiredInteger(input.classId, "classId");
    const rows = await this.query(SELECT_LATEST_LINK_BY_ENROLLMENT_AND_CLASS_SQL, [
      enrollmentId,
      classId,
    ]);

    return toEnrollmentClassLinkData(readFirstRow(rows));
  }

  /**
   * Counts active links for capacity validation without reading or mutating the
   * Turmas module. The capacity value itself must come from the injected Turmas
   * reader in the application service.
   *
   * @param {{ classId?: string|number|null }} input
   * @returns {Promise<{ classId: number, activeLinkCount: number, capacity: null, availableCapacity: null }>}
   */
  async getClassCapacitySnapshot(input = {}) {
    const classId = requiredInteger(input.classId, "classId");
    const rows = await this.query(SELECT_ACTIVE_LINK_COUNT_BY_CLASS_SQL, [classId, ACTIVE_STATUS]);
    const row = readFirstRow(rows);

    return {
      activeLinkCount: normalizeCount(row?.active_link_count),
      availableCapacity: null,
      capacity: null,
      classId,
    };
  }

  /**
   * @param {Object} input
   * @param {string|null} input.enrollmentId
   * @param {string|number|null} input.classId
   * @param {string|null} [input.unlinkedBy]
   * @param {string|null} [input.unlinkedAt]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async unlinkActiveLink(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const classId = requiredInteger(input.classId, "classId");

    await this.query(UPDATE_UNLINK_ACTIVE_LINK_SQL, [
      INACTIVE_STATUS,
      nullableText(input.unlinkedAt, 32),
      nullableText(input.unlinkedBy, 191),
      enrollmentId,
      classId,
      ACTIVE_STATUS,
    ]);

    return this.findActiveByEnrollmentAndClass({ classId, enrollmentId });
  }
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ id: string, enrollmentId: string, classId: number, linkedAt: string|null, linkedBy: string|null, origin: string, metadataJson: string|null }}
 */
function normalizeCreateInput(input = {}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : null;

  return {
    classId: requiredInteger(input.classId, "classId"),
    enrollmentId: requiredText(input.enrollmentId, "enrollmentId", 64),
    id: nullableText(input.id, 64) || randomUUID(),
    linkedAt: nullableText(input.linkedAt, 32),
    linkedBy: nullableText(input.linkedBy, 191),
    metadataJson: metadata ? JSON.stringify(metadata) : null,
    origin: nullableText(input.origin, 50) || "MANUAL",
  };
}

/**
 * @param {Record<string, unknown>|null} row
 * @returns {Record<string, unknown>|null}
 */
function toEnrollmentClassLinkData(row) {
  if (!row || typeof row !== "object") return null;

  return {
    classId: row.class_id == null ? null : Number(row.class_id),
    createdAt: row.created_at ?? null,
    enrollmentId: row.enrollment_id ?? null,
    id: row.id == null ? null : String(row.id),
    linkedAt: row.linked_at ?? null,
    linkedBy: row.linked_by ?? null,
    metadata: parseMetadata(row.metadata_json),
    origin: row.origin ?? null,
    status: row.status ?? null,
    unlinkedAt: row.unlinked_at ?? null,
    unlinkedBy: row.unlinked_by ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * @param {unknown} result
 * @returns {Record<string, unknown>|null}
 */
function readFirstRow(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];

  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function parseMetadata(value) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isActiveLinkDuplicateEntryError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;

  if (!duplicateCode && !duplicateErrno) {
    return false;
  }

  const message = [error.message, error.sqlMessage, error.sql].filter(Boolean).join(" ");
  return message.includes(ACTIVE_LINK_UNIQUE_INDEX);
}

/**
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requiredInteger(value, field) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    throw new TypeError(`MySqlEnrollmentClassLinkRepository requires ${field}.`);
  }

  return Number(normalized);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlEnrollmentClassLinkRepository requires ${field}.`);
  }

  return normalized;
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

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

module.exports = {
  ACTIVE_LINK_UNIQUE_INDEX,
  ACTIVE_STATUS,
  INSERT_ACTIVE_LINK_SQL,
  INACTIVE_STATUS,
  MySqlEnrollmentClassLinkRepository,
  SELECT_ACTIVE_LINK_COUNT_BY_CLASS_SQL,
  SELECT_ACTIVE_LINK_BY_ENROLLMENT_AND_CLASS_SQL,
  SELECT_LATEST_LINK_BY_ENROLLMENT_AND_CLASS_SQL,
  SELECT_LINK_BY_ID_SQL,
  TABLE_NAME,
  UPDATE_UNLINK_ACTIVE_LINK_SQL,
  isActiveLinkDuplicateEntryError,
  readFirstRow,
  toEnrollmentClassLinkData,
};
