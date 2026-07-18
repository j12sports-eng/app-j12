const { randomUUID } = require("node:crypto");
const SELECT =
  "SELECT * FROM crm_leads WHERE id = ? AND unit_id = ? AND deleted_at IS NULL LIMIT 1";
const SELECT_UNIT_CONTEXT = "SELECT id, unit_id FROM crm_leads WHERE id = ? LIMIT 1";
const INTERNAL_LEAD_FIELDS = "l.id,l.unit_id,l.stage,l.status,l.created_at,l.updated_at";
const INTERNAL_CONVERSION_FIELDS =
  "sc.status AS student_conversion_status,sc.person_id AS student_person_id,sc.person_profile_id AS student_person_profile_id,sc.converted_at AS student_converted_at,ec.status AS enrollment_conversion_status,ec.enrollment_id,ec.enrollment_status,ec.converted_at AS enrollment_converted_at";
const INTERNAL_CONTACT_FIELDS = "l.contact_name,l.contact_email,l.contact_phone";
class MySqlCrmLeadRepository {
  constructor({ queryRunner, transactionRunner } = {}) {
    const db = queryRunner ? null : require("../../../config/db.js");
    this.query = queryRunner || db.query;
    this.transaction = transactionRunner || db.transaction;
  }
  async create(lead) {
    await this.query(
      `INSERT INTO crm_leads (id,unit_id,person_id,source,stage,status,assigned_to,contact_name,contact_email,contact_phone,qualified_at,converted_at,lost_at,lost_reason,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      values(lead),
    );
    await this.appendHistory(this.query, null, lead, "CREATED", lead.createdBy);
    return this.findById({ id: lead.id, unitId: lead.unitId });
  }
  async findById({ id, unitId }) {
    return first(await this.query(SELECT, [id, unitId]));
  }
  // Narrow lookup: the HTTP boundary needs only the trusted unit, never Lead PII.
  async findUnitContextById(leadId) {
    return first(await this.query(SELECT_UNIT_CONTEXT, [leadId]));
  }
  async listLeadsForInternalQuery(filters = {}) {
    const query = buildInternalLeadQuery(filters, false);
    const result = await this.query(query.sql, query.params);
    return rows(result);
  }
  async findLeadDetailForInternalQuery({ leadId, unitId = null } = {}) {
    const query = buildInternalLeadQuery({ leadId, unitId }, true);
    return first(await this.query(query.sql, query.params));
  }
  async findByContactIdentity({ unitId, email, phone }) {
    if (!email && !phone) return null;
    return first(
      await this.query(
        "SELECT * FROM crm_leads WHERE unit_id=? AND deleted_at IS NULL AND ((? IS NOT NULL AND contact_email=?) OR (? IS NOT NULL AND contact_phone=?)) ORDER BY created_at LIMIT 1",
        [unitId, email, email, phone, phone],
      ),
    );
  }
  async saveTransition({ current, next, action, actorId }) {
    return this.transaction(async (connection) => {
      const run = (sql, params) => connection.query(sql, params);
      await run(
        "UPDATE crm_leads SET stage=?,status=?,qualified_at=?,converted_at=?,lost_at=?,lost_reason=?,updated_by=?,updated_at=? WHERE id=? AND unit_id=? AND deleted_at IS NULL",
        [
          next.stage,
          next.status,
          next.qualifiedAt,
          next.convertedAt,
          next.lostAt,
          next.lostReason,
          next.updatedBy,
          next.updatedAt,
          next.id,
          next.unitId,
        ],
      );
      await this.appendHistory(run, current, next, action, actorId);
      const result = await run(SELECT, [next.id, next.unitId]);
      return first(result);
    });
  }
  async saveStageTransition({
    leadId,
    unitId,
    expectedStage,
    expectedStatus,
    next,
    action,
    actorId,
  }) {
    return this.transaction(async (connection) => {
      const run = (sql, params) => connection.query(sql, params);
      const current = first(await run(`${SELECT} FOR UPDATE`, [leadId, unitId]));
      if (!current) throw conflict("CRM_LEAD_NOT_FOUND");
      if (
        (expectedStage !== undefined && current.stage !== expectedStage) ||
        (expectedStatus !== undefined && current.status !== expectedStatus)
      )
        throw conflict("CRM_STAGE_CONFLICT");
      const result = await run(
        "UPDATE crm_leads SET stage=?,status=?,qualified_at=?,converted_at=?,lost_at=?,lost_reason=?,updated_by=?,updated_at=? WHERE id=? AND unit_id=? AND stage=? AND status=? AND deleted_at IS NULL",
        [
          next.stage,
          next.status,
          next.qualifiedAt,
          next.convertedAt,
          next.lostAt,
          next.lostReason,
          next.updatedBy,
          next.updatedAt,
          leadId,
          unitId,
          current.stage,
          current.status,
        ],
      );
      if (Number(result?.affectedRows) !== 1) throw conflict("CRM_STAGE_CONFLICT");
      await this.appendHistory(run, current, next, action, actorId);
      return first(await run(SELECT, [leadId, unitId]));
    });
  }
  async listStageHistory({ leadId, unitId }) {
    const result = await this.query(
      "SELECT id,lead_id,unit_id,previous_stage,new_stage,previous_status,new_status,action,actor_id,reason,created_at FROM crm_lead_stage_history WHERE lead_id=? AND unit_id=? ORDER BY created_at ASC,id ASC",
      [leadId, unitId],
    );
    return Array.isArray(result?.[0]) ? result[0] : result || [];
  }
  async appendHistory(run, current, next, action, actorId) {
    await run(
      "INSERT INTO crm_lead_stage_history (id,lead_id,unit_id,previous_stage,new_stage,previous_status,new_status,action,actor_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        next.id,
        next.unitId,
        current?.stage || null,
        next.stage,
        current?.status || null,
        next.status,
        action,
        actorId,
        next.status === "LOST" ? next.lostReason : null,
        next.updatedAt,
      ],
    );
  }
}
function buildInternalLeadQuery(filters = {}, detail = false) {
  const fields = [INTERNAL_LEAD_FIELDS, INTERNAL_CONVERSION_FIELDS];
  if (detail) fields.push(INTERNAL_CONTACT_FIELDS);
  const where = ["l.deleted_at IS NULL"];
  const params = [];
  if (filters.leadId) {
    where.push("l.id = ?");
    params.push(filters.leadId);
  }
  if (filters.unitId) {
    where.push("l.unit_id = ?");
    params.push(filters.unitId);
  }
  if (filters.stage) {
    where.push("l.stage = ?");
    params.push(filters.stage);
  }
  if (filters.status) {
    where.push("l.status = ?");
    params.push(filters.status);
  }
  if (filters.conversionStatus === "NONE") where.push("sc.id IS NULL AND ec.id IS NULL");
  if (filters.conversionStatus === "STUDENT_COMPLETED") where.push("sc.status = 'COMPLETED'");
  if (filters.conversionStatus === "ENROLLMENT_COMPLETED") where.push("ec.status = 'COMPLETED'");
  if (filters.cursor) {
    where.push("(l.created_at < ? OR (l.created_at = ? AND l.id < ?))");
    params.push(filters.cursor.createdAt, filters.cursor.createdAt, filters.cursor.id);
  }
  const sql = `SELECT ${fields.join(",")} FROM crm_leads l LEFT JOIN crm_lead_student_conversions sc ON sc.lead_id=l.id AND sc.unit_id=l.unit_id LEFT JOIN crm_lead_enrollment_conversions ec ON ec.lead_id=l.id AND ec.unit_id=l.unit_id WHERE ${where.join(" AND ")} ORDER BY l.created_at DESC,l.id DESC${detail ? " LIMIT 1" : " LIMIT ?"}`;
  if (!detail) params.push(Math.min(Number(filters.fetchLimit) || 51, 101));
  return { params, sql };
}
function rows(result) {
  const value = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(value) ? value : [];
}
function conflict(code) {
  return Object.assign(new Error(code), { code });
}
function values(l) {
  return [
    l.id,
    l.unitId,
    l.personId,
    l.source,
    l.stage,
    l.status,
    l.assignedTo,
    l.contactName,
    l.contactEmail,
    l.contactPhone,
    l.qualifiedAt,
    l.convertedAt,
    l.lostAt,
    l.lostReason,
    l.createdBy,
    l.updatedBy,
    l.createdAt,
    l.updatedAt,
  ];
}
function first(result) {
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(rows) ? rows[0] || null : null;
}
module.exports = { MySqlCrmLeadRepository, SELECT, SELECT_UNIT_CONTEXT };
