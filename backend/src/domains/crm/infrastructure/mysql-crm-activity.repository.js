const SELECT = "SELECT id,lead_id,unit_id,activity_type,status,subject,description,scheduled_at,completed_at,created_at,created_by,metadata FROM crm_activities WHERE id=? AND unit_id=? LIMIT 1";

class MySqlCrmActivityRepository {
  constructor({ queryRunner, transactionRunner } = {}) {
    const db = queryRunner ? null : require("../../../config/db.js");
    this.query = queryRunner || db.query;
    this.transaction = transactionRunner || db.transaction;
  }

  async createActivity(activity) {
    await this.query("INSERT INTO crm_activities (id,lead_id,unit_id,activity_type,status,subject,description,scheduled_at,completed_at,created_at,created_by,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", values(activity));
    return this.findById({ id: activity.id, unitId: activity.unitId });
  }
  async findByLead({ leadId, unitId }) {
    return rows(await this.query("SELECT id,lead_id,unit_id,activity_type,status,subject,description,scheduled_at,completed_at,created_at,created_by,metadata FROM crm_activities WHERE lead_id=? AND unit_id=? ORDER BY created_at ASC,id ASC", [leadId, unitId])).map(mapRow);
  }
  async findById({ id, unitId }) { const row = first(await this.query(SELECT, [id, unitId])); return row ? mapRow(row) : null; }
  async completeTask({ id, unitId, completedAt }) { return this.transitionTask({ id, unitId, status: "COMPLETED", completedAt }); }
  async cancelTask({ id, unitId }) { return this.transitionTask({ id, unitId, status: "CANCELLED", completedAt: null }); }
  async listPendingTasks({ unitId }) {
    return rows(await this.query("SELECT id,lead_id,unit_id,activity_type,status,subject,description,scheduled_at,completed_at,created_at,created_by,metadata FROM crm_activities WHERE unit_id=? AND activity_type='TASK' AND status='PENDING' ORDER BY scheduled_at IS NULL,scheduled_at ASC,created_at ASC,id ASC", [unitId])).map(mapRow);
  }
  async transitionTask({ id, unitId, status, completedAt }) {
    return this.transaction(async (connection) => {
      const run = (sql, params) => connection.query(sql, params);
      const current = first(await run(`${SELECT} FOR UPDATE`, [id, unitId]));
      if (!current) throw conflict("CRM_ACTIVITY_NOT_FOUND");
      if (current.activity_type !== "TASK") throw conflict("CRM_ACTIVITY_NOT_TASK");
      if (current.status !== "PENDING") throw conflict("CRM_ACTIVITY_CONFLICT");
      const result = await run("UPDATE crm_activities SET status=?,completed_at=? WHERE id=? AND unit_id=? AND activity_type='TASK' AND status='PENDING'", [status, completedAt, id, unitId]);
      if (Number(result?.affectedRows) !== 1) throw conflict("CRM_ACTIVITY_CONFLICT");
      return mapRow(first(await run(SELECT, [id, unitId])));
    });
  }
}

function values(a) { return [a.id,a.leadId,a.unitId,a.activityType,a.status,a.subject,a.description,a.scheduledAt,a.completedAt,a.createdAt,a.createdBy,JSON.stringify(a.metadata)]; }
function mapRow(row) { return { id:row.id,leadId:row.lead_id,unitId:row.unit_id,activityType:row.activity_type,status:row.status,subject:row.subject,description:row.description,scheduledAt:iso(row.scheduled_at),completedAt:iso(row.completed_at),createdAt:iso(row.created_at),createdBy:row.created_by,metadata:parseMetadata(row.metadata) }; }
function parseMetadata(value) { if (!value) return {}; if (typeof value === "object") return value; try { return JSON.parse(value); } catch { return {}; } }
function iso(value) { return value instanceof Date ? value.toISOString() : value || null; }
function rows(result) { return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : []; }
function first(result) { return rows(result)[0] || null; }
function conflict(code) { return Object.assign(new Error(code), { code }); }
module.exports = { MySqlCrmActivityRepository, SELECT };
