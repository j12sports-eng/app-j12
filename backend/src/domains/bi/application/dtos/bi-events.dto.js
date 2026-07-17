function createBiEventsDto({ analytics = {}, filters, generatedAt }) {
  const summary = analytics.summary || {};
  return Object.freeze({
    version: "27.12", generatedAt, source: "j12_campeonatos", readOnly: true, filters,
    kpis: Object.freeze({
      totalEvents: metric(summary.totalEvents),
      publishedEvents: metric(summary.publishedEvents),
      completedEvents: metric(summary.completedEvents),
      upcomingEvents: metric(summary.upcomingEvents),
      scheduledEvents: unavailable("NO_CANONICAL_SCHEDULED_STATUS"),
      cancelledEvents: unavailable("NO_CANONICAL_CANCELLATION_STATUS"),
    }),
    dimensions: Object.freeze({
      monthlyEvolution: freezeRows(analytics.monthlyEvolution),
      eventsByType: freezeRows(analytics.eventsByType),
      eventsByStatus: freezeRows(analytics.eventsByStatus),
      eventsByUnit: Object.freeze([]),
    }),
  });
}
function metric(value) {
  const parsed = Number(value);
  return Object.freeze({ available: true, reason: null, unit: "count",
    value: Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0 });
}
function unavailable(reason) {
  return Object.freeze({ available: false, reason, unit: "count", value: null });
}
function freezeRows(rows) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({ ...row })));
}
module.exports = { createBiEventsDto };
