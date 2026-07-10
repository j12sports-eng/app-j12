const UNAVAILABLE = Object.freeze({
  cancellations: "NO_CANONICAL_CANCELLATION_TIMESTAMP",
  churnRate: "NO_CANONICAL_CANCELLATION_HISTORY",
  netGrowth: "NO_CANONICAL_EXIT_SERIES",
  retentionRate: "NO_HISTORICAL_ENROLLMENT_SNAPSHOTS",
  averageTenureDays: "NO_CANONICAL_COMPLETE_TENURE_INTERVALS",
  transfers: "NO_CANONICAL_TRANSFER_MODEL",
});

function createBiStudentsDto({ analytics, filters, generatedAt }) {
  const current = analytics.current || {};
  const previous = analytics.previous || {};
  return Object.freeze({
    contractVersion: "21.4",
    distributions: Object.freeze({
      ageGroups: dimension(analytics.ageGroups),
      modalities: dimension(analytics.modalities),
      units: dimension(analytics.units),
    }),
    evolution: Object.freeze(
      (analytics.evolution || []).map((row) =>
        Object.freeze({
          newEnrollments: count(row.newEnrollments),
          newStudents: count(row.newStudents),
          period: text(row.period),
        }),
      ),
    ),
    filters,
    generatedAt,
    kpis: Object.freeze({
      activeEnrollments: snapshotMetric(current.activeEnrollments, "count"),
      activeStudents: snapshotMetric(current.activeStudents, "count"),
      averageTenureDays: unavailableMetric("days", UNAVAILABLE.averageTenureDays),
      cancellations: unavailableMetric("count", UNAVAILABLE.cancellations),
      churnRate: unavailableMetric("percentage", UNAVAILABLE.churnRate),
      netGrowth: unavailableMetric("count", UNAVAILABLE.netGrowth),
      newEnrollments: comparableMetric(current.newEnrollments, previous.newEnrollments),
      newStudents: comparableMetric(current.newStudents, previous.newStudents),
      retentionRate: unavailableMetric("percentage", UNAVAILABLE.retentionRate),
      transfers: unavailableMetric("count", UNAVAILABLE.transfers),
    }),
    readOnly: true,
  });
}

function snapshotMetric(value, unit) {
  return Object.freeze({
    available: true,
    comparison: unavailableComparison("NO_HISTORICAL_SNAPSHOT"),
    reason: null,
    unit,
    value: count(value),
  });
}
function comparableMetric(value, previousValue) {
  const current = count(value);
  const previous = count(previousValue);
  return Object.freeze({
    available: true,
    comparison: comparison(current, previous),
    reason: null,
    unit: "count",
    value: current,
  });
}
function unavailableMetric(unit, reason) {
  return Object.freeze({
    available: false,
    comparison: unavailableComparison(reason),
    reason,
    unit,
    value: null,
  });
}
function comparison(current, previous) {
  if (previous === 0) return unavailableComparison("PREVIOUS_VALUE_ZERO", previous);
  const percent = Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
  return Object.freeze({
    available: true,
    percent,
    previousValue: previous,
    reason: null,
    trend: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral",
  });
}
function unavailableComparison(reason, previousValue = null) {
  return Object.freeze({
    available: false,
    percent: null,
    previousValue,
    reason,
    trend: "unavailable",
  });
}
function dimension(rows) {
  return Object.freeze(
    (rows || []).map((row) =>
      Object.freeze({ key: text(row.key) || "nao_informado", value: count(row.value) }),
    ),
  );
}
function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}
function text(value) {
  return value == null ? "" : String(value);
}

module.exports = { UNAVAILABLE, createBiStudentsDto };
