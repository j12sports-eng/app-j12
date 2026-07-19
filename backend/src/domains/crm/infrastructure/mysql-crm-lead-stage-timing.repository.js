const DEFAULT_HISTORY_LIMIT = 500;
const MAX_HISTORY_LIMIT = 500;

const SELECT_LEAD_TIMING =
  "SELECT id,unit_id,stage,status FROM crm_leads WHERE id=? AND deleted_at IS NULL";
const SELECT_HISTORY =
  "SELECT id,lead_id,unit_id,previous_stage,new_stage,previous_status,new_status,action,actor_id,created_at FROM crm_lead_stage_history WHERE lead_id=? AND unit_id=? ORDER BY created_at DESC,id DESC LIMIT ?";

class MySqlCrmLeadStageTimingRepository {
  constructor({ queryRunner } = {}) {
    const db = queryRunner ? null : require("../../../config/db.js");
    this.query = queryRunner || db.query;
  }

  async findLeadForStageTiming({ leadId, unitId = null } = {}) {
    const params = [leadId];
    const sql = `${SELECT_LEAD_TIMING}${unitId ? " AND unit_id=?" : ""} LIMIT 1`;
    if (unitId) params.push(unitId);
    return first(await this.query(sql, params));
  }

  async findStageHistoryByLeadId({ leadId, unitId, limit = DEFAULT_HISTORY_LIMIT } = {}) {
    const normalizedLimit = Math.min(
      Math.max(Number(limit) || DEFAULT_HISTORY_LIMIT, 1),
      MAX_HISTORY_LIMIT,
    );
    const result = await this.query(SELECT_HISTORY, [leadId, unitId, normalizedLimit + 1]);
    const values = rows(result);
    return Object.freeze({
      items: Object.freeze(values.slice(0, normalizedLimit)),
      truncated: values.length > normalizedLimit,
    });
  }
}

function rows(result) {
  const value = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(value) ? value : [];
}

function first(result) {
  return rows(result)[0] || null;
}

module.exports = {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  MySqlCrmLeadStageTimingRepository,
  SELECT_HISTORY,
  SELECT_LEAD_TIMING,
};
