const { BiReadRepositoryContract } = require("../../application/index.js");
const COURTS_SQL = `SELECT id,nome,status,unidade,funcionamento_json FROM j12_quadras WHERE (? IS NULL OR unidade=? OR CAST(id AS CHAR)=?) ORDER BY nome,id`;
const RESERVATIONS_SQL = `SELECT r.id,r.quadra_id,r.start_at,r.end_at,r.duration_minutes,r.status,r.payment_status,r.final_value,r.financial_charge_id,r.recurrence_group_id,q.nome court_name,q.unidade
FROM j12_quadra_reservas r INNER JOIN j12_quadras q ON q.id=r.quadra_id
WHERE r.start_at < DATE_ADD(?,INTERVAL 1 DAY) AND r.end_at >= ?
AND (? IS NULL OR q.unidade=? OR CAST(q.id AS CHAR)=?) ORDER BY r.start_at,r.id`;
class MySqlBiCourtsRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || defaultQuery();
  }
  async getCourtAnalytics({ current }) {
    const [courts, reservations] = await Promise.all([
      this.query(COURTS_SQL, courtParams(current)),
      this.query(RESERVATIONS_SQL, reservationParams(current)),
    ]);
    return { courts: rows(courts), reservations: rows(reservations) };
  }
}
function courtParams(p) {
  return [p.unitId, p.unitId, p.unitId];
}
function reservationParams(p) {
  return [p.endDate, p.startDate, p.unitId, p.unitId, p.unitId];
}
function rows(r) {
  if (!Array.isArray(r)) return [];
  return Array.isArray(r[0]) ? r[0] : r;
}
function defaultQuery() {
  return require("../../../../config/db.js").query;
}
module.exports = {
  COURTS_SQL,
  MySqlBiCourtsRepository,
  RESERVATIONS_SQL,
  courtParams,
  reservationParams,
};
