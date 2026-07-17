const { BiReadRepositoryContract } = require("../../application/index.js");

const BI_AGENDA_SERIES_SQL = `
  SELECT
    SUM(CASE WHEN series.start_date <= ?
      AND (series.end_date IS NULL OR series.end_date >= ?) THEN 1 ELSE 0 END) recurrence_series,
    SUM(CASE WHEN series.status = 'ACTIVE' AND series.start_date <= ?
      AND (series.end_date IS NULL OR series.end_date >= ?) THEN 1 ELSE 0 END) active_series,
    SUM(CASE WHEN series.status = 'CANCELLED'
      AND DATE(series.cancelled_at) BETWEEN ? AND ? THEN 1 ELSE 0 END) cancelled_series
  FROM agenda_recurrence_series series
  LEFT JOIN j12_turmas turma ON turma.id = series.class_id
  WHERE (? IS NULL OR CAST(turma.unidade_id AS CHAR) = ?)
`;

const BI_AGENDA_EXCEPTIONS_SQL = `
  SELECT exception_record.occurrence_date occurrence_date,
    SUM(CASE WHEN exception_record.exception_type = 'CANCELLED' THEN 1 ELSE 0 END)
      cancelled_occurrences,
    SUM(CASE WHEN exception_record.exception_type = 'MODIFIED' THEN 1 ELSE 0 END)
      modified_occurrences
  FROM agenda_recurrence_exceptions exception_record
  INNER JOIN agenda_recurrence_series series ON series.id = exception_record.series_id
  LEFT JOIN j12_turmas turma ON turma.id = series.class_id
  WHERE exception_record.occurrence_date BETWEEN ? AND ?
    AND (? IS NULL OR CAST(turma.unidade_id AS CHAR) = ?)
  GROUP BY exception_record.occurrence_date
  ORDER BY exception_record.occurrence_date ASC
`;

class MySqlBiAgendaRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getAgendaAnalytics({ current }) {
    const [seriesResult, exceptionsResult] = await Promise.all([
      this.query(BI_AGENDA_SERIES_SQL, seriesParams(current)),
      this.query(BI_AGENDA_EXCEPTIONS_SQL, exceptionParams(current)),
    ]);
    const seriesRow = readRows(seriesResult)[0] || {};
    const timeline = readRows(exceptionsResult).map(toTimelinePoint);
    return {
      cancelledOccurrences: sum(timeline, "cancelledOccurrences"),
      modifiedOccurrences: sum(timeline, "modifiedOccurrences"),
      series: {
        activeSeries: count(seriesRow.active_series),
        cancelledSeries: count(seriesRow.cancelled_series),
        recurrenceSeries: count(seriesRow.recurrence_series),
      },
      timeline,
    };
  }
}

function seriesParams(current) {
  return [
    current.endDate,
    current.startDate,
    current.endDate,
    current.startDate,
    current.startDate,
    current.endDate,
    current.unitId,
    current.unitId,
  ];
}

function exceptionParams(current) {
  return [current.startDate, current.endDate, current.unitId, current.unitId];
}

function toTimelinePoint(row = {}) {
  return {
    cancelledOccurrences: count(row.cancelled_occurrences),
    date: normalizeDate(row.occurrence_date),
    modifiedOccurrences: count(row.modified_occurrences),
  };
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return value == null ? null : String(value).slice(0, 10);
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + count(row[field]), 0);
}

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  BI_AGENDA_EXCEPTIONS_SQL,
  BI_AGENDA_SERIES_SQL,
  MySqlBiAgendaRepository,
  exceptionParams,
  seriesParams,
};
