const { BiReadRepositoryContract } = require("../../application/index.js");
const BASE_SCOPE = `FROM j12_campeonatos
WHERE deleted_at IS NULL AND status <> 'REMOVED'
  AND start_date <= ? AND end_date >= ?`;
const EVENTS_SUMMARY_SQL = `SELECT
  COUNT(*) total_events,
  SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) published_events,
  SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) completed_events,
  SUM(CASE WHEN status = 'PUBLISHED' AND start_date > ? THEN 1 ELSE 0 END) upcoming_events
${BASE_SCOPE}`;
const EVENTS_MONTHLY_SQL = `SELECT DATE_FORMAT(start_date, '%Y-%m') period, COUNT(*) events
${BASE_SCOPE}
GROUP BY DATE_FORMAT(start_date, '%Y-%m') ORDER BY period`;
const EVENTS_BY_TYPE_SQL = `SELECT COALESCE(NULLIF(TRIM(category), ''), 'nao_informado') type,
  COUNT(*) events
${BASE_SCOPE}
GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'nao_informado') ORDER BY type`;
const EVENTS_BY_STATUS_SQL = `SELECT status, COUNT(*) events
${BASE_SCOPE}
GROUP BY status ORDER BY status`;
class MySqlBiEventsRepository extends BiReadRepositoryContract {
  constructor(options = {}) { super(); this.query = options.queryRunner || defaultQuery(); }
  async getEventAnalytics({ current, today }) {
    const scope = [current.endDate, current.startDate];
    const [summaryResult, monthlyResult, typeResult, statusResult] = await Promise.all([
      this.query(EVENTS_SUMMARY_SQL, [today, ...scope]),
      this.query(EVENTS_MONTHLY_SQL, scope),
      this.query(EVENTS_BY_TYPE_SQL, scope),
      this.query(EVENTS_BY_STATUS_SQL, scope),
    ]);
    const summary = rows(summaryResult)[0] || {};
    return {
      summary: { totalEvents: count(summary.total_events),
        publishedEvents: count(summary.published_events),
        completedEvents: count(summary.completed_events),
        upcomingEvents: count(summary.upcoming_events) },
      monthlyEvolution: rows(monthlyResult).map((row) => ({ period: text(row.period), events: count(row.events) })),
      eventsByType: rows(typeResult).map((row) => ({ type: text(row.type), events: count(row.events) })),
      eventsByStatus: rows(statusResult).map((row) => ({ status: text(row.status), events: count(row.events) })),
    };
  }
}
function rows(result) { if (!Array.isArray(result)) return []; return Array.isArray(result[0]) ? result[0] : result; }
function count(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0; }
function text(value) { return value == null ? "nao_informado" : String(value); }
function defaultQuery() { return require("../../../../config/db.js").query; }
module.exports = { EVENTS_BY_STATUS_SQL, EVENTS_BY_TYPE_SQL, EVENTS_MONTHLY_SQL,
  EVENTS_SUMMARY_SQL, MySqlBiEventsRepository };
