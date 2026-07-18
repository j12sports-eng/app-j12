const TABLE = "crm_lead_enrollment_conversions";
const HISTORY_FIELDS =
  "ec.id,ec.lead_id,ec.unit_id,ec.person_id,ec.person_profile_id,ec.enrollment_id,ec.enrollment_status,ec.status,ec.converted_by,ec.converted_at";
const SELECT_BY_ID = `SELECT ${HISTORY_FIELDS} FROM ${TABLE} ec WHERE ec.id=? AND ec.status=? LIMIT 1`;
const MAX_FETCH_LIMIT = 101;

/** Read-only projection for the persisted history of completed CRM conversions. */
class MySqlCrmLeadConversionHistoryRepository {
  constructor({ queryRunner } = {}) {
    const database = queryRunner ? null : require("../../../config/db.js");
    this.query = queryRunner || database.query;
  }

  async listConversionHistory(filters = {}) {
    const query = buildConversionHistoryQuery(filters);
    return rows(await this.query(query.sql, query.params)).map(mapRow);
  }

  async findConversionHistoryById(conversionId) {
    return mapRow(first(await this.query(SELECT_BY_ID, [conversionId, "COMPLETED"])));
  }
}

function buildConversionHistoryQuery(filters = {}) {
  const where = ["ec.status=?"];
  const params = ["COMPLETED"];

  addFilter(where, params, "ec.lead_id", filters.leadId);
  addFilter(where, params, "ec.unit_id", filters.unitId);
  addFilter(where, params, "ec.converted_by", filters.convertedBy);
  addFilter(where, params, "ec.enrollment_status", filters.enrollmentStatus);

  if (filters.dateFrom) {
    where.push("ec.converted_at>=?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push("ec.converted_at<=?");
    params.push(filters.dateTo);
  }
  if (filters.cursor) {
    where.push("(ec.converted_at<? OR (ec.converted_at=? AND ec.id<?))");
    params.push(filters.cursor.convertedAt, filters.cursor.convertedAt, filters.cursor.id);
  }

  const fetchLimit = Math.min(
    Math.max(Number.isSafeInteger(filters.fetchLimit) ? filters.fetchLimit : 51, 1),
    MAX_FETCH_LIMIT,
  );
  params.push(fetchLimit);

  return {
    params,
    sql: `SELECT ${HISTORY_FIELDS} FROM ${TABLE} ec WHERE ${where.join(
      " AND ",
    )} ORDER BY ec.converted_at DESC,ec.id DESC LIMIT ?`,
  };
}

function addFilter(where, params, column, value) {
  if (value == null) return;
  where.push(`${column}=?`);
  params.push(value);
}

function mapRow(row) {
  if (!row) return null;
  return Object.freeze({
    conversionStatus: row.status ?? row.conversionStatus ?? null,
    convertedAt: iso(row.converted_at ?? row.convertedAt),
    convertedBy: row.converted_by ?? row.convertedBy ?? null,
    enrollmentId: row.enrollment_id ?? row.enrollmentId ?? null,
    enrollmentStatus: row.enrollment_status ?? row.enrollmentStatus ?? null,
    id: row.id,
    leadId: row.lead_id ?? row.leadId ?? null,
    personId: row.person_id ?? row.personId ?? null,
    personProfileId: row.person_profile_id ?? row.personProfileId ?? null,
    unitId: row.unit_id ?? row.unitId ?? null,
  });
}

function rows(result) {
  const value = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(value) ? value : [];
}

function first(result) {
  return rows(result)[0] || null;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

module.exports = {
  HISTORY_FIELDS,
  MAX_FETCH_LIMIT,
  MySqlCrmLeadConversionHistoryRepository,
  SELECT_BY_ID,
  TABLE,
  buildConversionHistoryQuery,
  mapRow,
};
