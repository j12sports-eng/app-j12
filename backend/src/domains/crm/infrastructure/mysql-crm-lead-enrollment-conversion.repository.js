const { randomUUID } = require("node:crypto");

const TABLE = "crm_lead_enrollment_conversions";
const SELECT_BY_LEAD = `SELECT id,lead_id,unit_id,person_id,person_profile_id,enrollment_id,enrollment_status,status,converted_by,converted_at,idempotency_key,metadata_json FROM ${TABLE} WHERE lead_id=? AND unit_id=? LIMIT 1`;
const LOCK_LEAD =
  "SELECT id FROM crm_leads WHERE id=? AND unit_id=? AND deleted_at IS NULL FOR UPDATE";
const INSERT = `INSERT INTO ${TABLE} (id,lead_id,unit_id,person_id,person_profile_id,enrollment_id,enrollment_status,status,converted_by,converted_at,idempotency_key,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

class MySqlCrmLeadEnrollmentConversionRepository {
  constructor({ queryRunner, transactionRunner } = {}) {
    const database = queryRunner ? null : require("../../../config/db.js");
    this.query = queryRunner || database.query;
    this.transaction = transactionRunner || database.transaction;
  }

  async findByLeadId({ leadId, unitId }) {
    return mapRow(first(await this.query(SELECT_BY_LEAD, [leadId, unitId])));
  }

  async create(input = {}) {
    return this.transaction(async (connection) => {
      const run = (sql, params) => connection.query(sql, params);
      const lockedLead = first(await run(LOCK_LEAD, [input.leadId, input.unitId]));
      if (!lockedLead) throw repositoryError("CRM_LEAD_NOT_FOUND");

      const existing = mapRow(first(await run(SELECT_BY_LEAD, [input.leadId, input.unitId])));
      if (existing) return { conversion: existing, created: false, reused: true };

      const record = normalizeRecord({ ...input, id: input.id || randomUUID() });
      try {
        await run(INSERT, toValues(record));
      } catch (error) {
        if (!isDuplicateEntry(error)) throw error;
        const recovered = mapRow(first(await run(SELECT_BY_LEAD, [input.leadId, input.unitId])));
        if (!recovered) throw repositoryError("CRM_LEAD_ENROLLMENT_CONFLICT");
        return { conversion: recovered, created: false, reused: true };
      }

      const created = mapRow(first(await run(SELECT_BY_LEAD, [input.leadId, input.unitId])));
      if (!created) throw repositoryError("CRM_LEAD_ENROLLMENT_CONVERSION_FAILED");
      return { conversion: created, created: true, reused: false };
    });
  }

  async findAfterDuplicate({ leadId, unitId }) {
    return this.findByLeadId({ leadId, unitId });
  }
}

function normalizeRecord(input) {
  return {
    convertedAt: input.convertedAt,
    convertedBy: input.convertedBy,
    enrollmentId: input.enrollmentId,
    enrollmentStatus: input.enrollmentStatus || "DRAFT",
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    leadId: input.leadId,
    metadata: input.metadata || null,
    personId: input.personId,
    personProfileId: input.personProfileId,
    status: input.status || "COMPLETED",
    unitId: input.unitId,
  };
}

function toValues(record) {
  return [
    record.id,
    record.leadId,
    record.unitId,
    record.personId,
    record.personProfileId,
    record.enrollmentId,
    record.enrollmentStatus,
    record.status,
    record.convertedBy,
    record.convertedAt,
    record.idempotencyKey,
    record.metadata ? JSON.stringify(record.metadata) : null,
  ];
}

function mapRow(row) {
  if (!row) return null;
  return Object.freeze({
    convertedAt: iso(row.converted_at),
    convertedBy: row.converted_by,
    enrollmentId: row.enrollment_id,
    enrollmentStatus: row.enrollment_status,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    leadId: row.lead_id,
    personId: row.person_id,
    personProfileId: row.person_profile_id,
    status: row.status,
    unitId: row.unit_id,
  });
}

function first(result) {
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(rows) ? rows[0] || null : null;
}
function iso(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}
function isDuplicateEntry(error) {
  return error?.code === "ER_DUP_ENTRY" || Number(error?.errno) === 1062;
}
function repositoryError(code) {
  return Object.assign(new Error(code), { code });
}

module.exports = {
  INSERT,
  LOCK_LEAD,
  MySqlCrmLeadEnrollmentConversionRepository,
  SELECT_BY_LEAD,
  TABLE,
  isDuplicateEntry,
  mapRow,
  toValues,
};
