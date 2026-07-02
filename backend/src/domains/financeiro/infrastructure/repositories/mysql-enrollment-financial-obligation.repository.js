const { randomUUID } = require("node:crypto");

const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const TABLE_NAME = "enrollment_financial_obligations";
const ENROLLMENT_OBLIGATION_UNIQUE_INDEX =
  "ux_enrollment_financial_obligations_enrollment_type";

const INSERT_ENROLLMENT_FINANCIAL_OBLIGATION_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    enrollment_id,
    obligation_type,
    status,
    amount,
    currency,
    plan_id,
    due_date,
    source,
    created_by,
    metadata_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ID_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ENROLLMENT_AND_TYPE_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE enrollment_id = ?
    AND obligation_type = ?
  LIMIT 1
`;

const SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_ENROLLMENT_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE enrollment_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT ?
`;

const SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_STUDENT_SCOPE_SQL = `
  SELECT obligation.*
  FROM enrollments enrollment
  INNER JOIN ${TABLE_NAME} obligation
    ON obligation.enrollment_id = enrollment.id
  WHERE enrollment.student_person_id = ?
    AND enrollment.student_profile_id = ?
    AND enrollment.deleted_at IS NULL
  ORDER BY obligation.due_date ASC, obligation.created_at ASC, obligation.id ASC
  LIMIT ?
`;

const UPDATE_ENROLLMENT_FINANCIAL_OBLIGATION_STATUS_SQL = `
  UPDATE ${TABLE_NAME}
  SET
    status = ?,
    cancelled_at = ?,
    cancelled_by = ?,
    metadata_json = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status IN (__CURRENT_STATUS_PLACEHOLDERS__)
`;

/**
 * MySQL repository for Enrollment-originated financial obligation records.
 *
 * This adapter only touches `enrollment_financial_obligations`. It does not
 * create j12_mensalidades, j12_financeiro_cobrancas, payments or gateway calls.
 */
class MySqlEnrollmentFinancialObligationRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * @param {{ enrollmentId?: string|null, obligationType?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findEnrollmentFinancialObligation(input = {}) {
    const values = normalizeLookupInput(input);
    const rows = await this.query(SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ENROLLMENT_AND_TYPE_SQL, [
      values.enrollmentId,
      values.obligationType,
    ]);

    return toEnrollmentFinancialObligationData(readFirstRow(rows));
  }

  /**
   * @param {{ enrollmentId?: string|null, limit?: number|null }} input
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async listEnrollmentFinancialObligations(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const limit = normalizeLimit(input.limit, 100);
    const rows = await this.query(SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_ENROLLMENT_SQL, [
      enrollmentId,
      limit,
    ]);

    return readRows(rows).map(toEnrollmentFinancialObligationData).filter(Boolean);
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null, limit?: number|null }} input
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async listEnrollmentFinancialObligationsByStudentScope(input = {}) {
    const studentPersonId = requiredText(input.studentPersonId, "studentPersonId", 64);
    const studentProfileId = requiredText(input.studentProfileId, "studentProfileId", 64);
    const limit = normalizeLimit(input.limit, 250);
    const rows = await this.query(
      SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_STUDENT_SCOPE_SQL,
      [studentPersonId, studentProfileId, limit],
    );

    return readRows(rows).map(toEnrollmentFinancialObligationData).filter(Boolean);
  }

  /**
   * @param {Object} input
   * @returns {Promise<{ obligation: Record<string, unknown>|null, created: boolean, reused: boolean }>}
   */
  async createEnrollmentFinancialObligationRecord(input = {}) {
    const values = normalizeCreateInput(input);

    try {
      await this.query(INSERT_ENROLLMENT_FINANCIAL_OBLIGATION_SQL, [
        values.id,
        values.enrollmentId,
        values.obligationType,
        values.status,
        values.amount,
        values.currency,
        values.planId,
        values.dueDate,
        values.source,
        values.createdBy,
        values.metadataJson,
      ]);

      return {
        created: true,
        obligation: await this.findById(values.id),
        reused: false,
      };
    } catch (error) {
      if (!isEnrollmentFinancialObligationDuplicateEntryError(error)) {
        throw error;
      }

      return {
        created: false,
        obligation: await this.findEnrollmentFinancialObligation(values),
        reused: true,
      };
    }
  }

  /**
   * @param {{ obligationId?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findEnrollmentFinancialObligationById(input = {}) {
    return this.findById(input.obligationId);
  }

  /**
   * @param {Object} input
   * @returns {Promise<{ obligation: Record<string, unknown>|null, updated: boolean }>}
   */
  async updateEnrollmentFinancialObligationStatus(input = {}) {
    const values = normalizeStatusUpdateInput(input);
    const placeholders = values.currentStatuses.map(() => "?").join(", ");

    const result = await this.query(
      UPDATE_ENROLLMENT_FINANCIAL_OBLIGATION_STATUS_SQL.replace(
        "__CURRENT_STATUS_PLACEHOLDERS__",
        placeholders,
      ),
      [
        values.status,
        values.cancelledAt,
        values.cancelledBy,
        values.metadataJson,
        values.obligationId,
        ...values.currentStatuses,
      ],
    );
    const updated = Number(result?.affectedRows || 0) === 1;

    return {
      obligation: await this.findById(values.obligationId),
      updated,
    };
  }

  /**
   * @param {string|null} id
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findById(id) {
    const obligationId = requiredText(id, "id", 64);
    const rows = await this.query(SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ID_SQL, [
      obligationId,
    ]);

    return toEnrollmentFinancialObligationData(readFirstRow(rows));
  }
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ enrollmentId: string, obligationType: string }}
 */
function normalizeLookupInput(input = {}) {
  return {
    enrollmentId: requiredText(input.enrollmentId, "enrollmentId", 64),
    obligationType: requiredText(input.obligationType, "obligationType", 64),
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeCreateInput(input = {}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : null;

  return {
    amount: normalizeAmount(input.amount),
    createdBy: nullableText(input.createdBy ?? input.requestedBy, 191),
    currency: normalizeCurrency(input.currency),
    dueDate: normalizeDate(input.dueDate),
    enrollmentId: requiredText(input.enrollmentId, "enrollmentId", 64),
    id: nullableText(input.id, 64) || randomUUID(),
    metadataJson: metadata ? JSON.stringify(metadata) : null,
    obligationType: requiredText(input.obligationType, "obligationType", 64),
    planId: nullableText(input.planId, 64),
    source: nullableText(input.source, 50) || "ENROLLMENT",
    status: requiredText(input.status, "status", 32),
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeStatusUpdateInput(input = {}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
  const currentStatuses = Array.isArray(input.currentStatuses)
    ? input.currentStatuses.map((status) => normalizeStatus(status)).filter(Boolean)
    : [];

  if (currentStatuses.length === 0) {
    throw new TypeError(
      "MySqlEnrollmentFinancialObligationRepository requires currentStatuses.",
    );
  }

  return {
    cancelledAt: normalizeDateTime(input.cancelledAt),
    cancelledBy: nullableText(input.cancelledBy, 191),
    currentStatuses,
    metadataJson: JSON.stringify(metadata),
    obligationId: requiredText(input.obligationId, "obligationId", 64),
    status: requiredText(normalizeStatus(input.status), "status", 32),
  };
}

/**
 * @param {Record<string, unknown>|null} row
 * @returns {Record<string, unknown>|null}
 */
function toEnrollmentFinancialObligationData(row) {
  if (!row || typeof row !== "object") return null;

  return {
    amount: row.amount == null ? null : Number(row.amount),
    cancelledAt: row.cancelled_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    currency: row.currency ?? null,
    dueDate: row.due_date ?? null,
    enrollmentId: row.enrollment_id ?? null,
    id: row.id == null ? null : String(row.id),
    metadata: parseMetadata(row.metadata_json),
    obligationType: row.obligation_type ?? null,
    planId: row.plan_id ?? null,
    source: row.source ?? null,
    status: row.status ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * @param {unknown} result
 * @returns {Record<string, unknown>|null}
 */
function readFirstRow(result) {
  const rows = readRows(result);
  const row = rows[0];

  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

/**
 * @param {unknown} result
 * @returns {Record<string, unknown>[]}
 */
function readRows(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  const rows = Array.isArray(result[0]) ? result[0] : result;

  return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
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
function isEnrollmentFinancialObligationDuplicateEntryError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;

  if (!duplicateCode && !duplicateErrno) {
    return false;
  }

  const message = [error.message, error.sqlMessage, error.sql].filter(Boolean).join(" ");
  return message.includes(ENROLLMENT_OBLIGATION_UNIQUE_INDEX);
}

/**
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeCurrency(value) {
  const normalized = nullableText(value, 3);
  return normalized ? normalized.toUpperCase() : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeDate(value) {
  const normalized = nullableText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized || "") ? normalized : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeDateTime(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const normalized = nullableText(value, 19);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized || "")) {
    return `${normalized} 00:00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized || "")) {
    return normalized.replace("T", " ");
  }

  return null;
}

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {number}
 */
function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeStatus(value) {
  const normalized = nullableText(value, 32);
  return normalized ? normalized.toUpperCase() : null;
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
    throw new TypeError(`MySqlEnrollmentFinancialObligationRepository requires ${field}.`);
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

module.exports = {
  ENROLLMENT_OBLIGATION_UNIQUE_INDEX,
  INSERT_ENROLLMENT_FINANCIAL_OBLIGATION_SQL,
  MySqlEnrollmentFinancialObligationRepository,
  SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_ENROLLMENT_SQL,
  SELECT_ENROLLMENT_FINANCIAL_OBLIGATIONS_BY_STUDENT_SCOPE_SQL,
  SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ENROLLMENT_AND_TYPE_SQL,
  SELECT_ENROLLMENT_FINANCIAL_OBLIGATION_BY_ID_SQL,
  TABLE_NAME,
  UPDATE_ENROLLMENT_FINANCIAL_OBLIGATION_STATUS_SQL,
  isEnrollmentFinancialObligationDuplicateEntryError,
  readFirstRow,
  readRows,
  toEnrollmentFinancialObligationData,
};
