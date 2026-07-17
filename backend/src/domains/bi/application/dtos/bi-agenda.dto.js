const UNAVAILABLE = Object.freeze({
  completedAppointments: "NO_CANONICAL_COMPLETION_STATUS",
  conflicts: "NO_CANONICAL_PERSISTED_CONFLICT",
  futureAppointments: "RECURRENCE_OCCURRENCES_NOT_MATERIALIZED",
  replacementAppointments: "NO_CANONICAL_REPLACEMENT_TYPE",
  scheduledDurationMinutes: "RECURRENCE_OCCURRENCES_NOT_MATERIALIZED",
  totalAppointments: "RECURRENCE_OCCURRENCES_NOT_MATERIALIZED",
});

function createBiAgendaDto({ analytics = {}, filters, generatedAt }) {
  const series = readObject(analytics.series);
  const timeline = Array.isArray(analytics.timeline)
    ? analytics.timeline.map(toTimelinePoint)
    : [];
  const cancelledOccurrences = count(analytics.cancelledOccurrences);
  const modifiedOccurrences = count(analytics.modifiedOccurrences);
  const exceptionTotal = cancelledOccurrences + modifiedOccurrences;

  return Object.freeze({
    contractVersion: "21.12",
    distributions: Object.freeze({
      exceptionTypes: Object.freeze({
        available: true,
        items: Object.freeze([
          Object.freeze({ key: "CANCELLED", value: cancelledOccurrences }),
          Object.freeze({ key: "MODIFIED", value: modifiedOccurrences }),
        ]),
        reason: null,
      }),
    }),
    filters,
    generatedAt,
    kpis: Object.freeze({
      activeRecurrenceSeries: metric(series.activeSeries),
      cancelledOccurrences: metric(cancelledOccurrences),
      cancelledRecurrenceSeries: metric(series.cancelledSeries),
      cancellationRate:
        exceptionTotal > 0
          ? metric(Number(((cancelledOccurrences / exceptionTotal) * 100).toFixed(2)), "percentage")
          : unavailableMetric("percentage", "NO_RECURRENCE_EXCEPTIONS_IN_PERIOD"),
      completedAppointments: unavailableMetric("count", UNAVAILABLE.completedAppointments),
      conflicts: unavailableMetric("count", UNAVAILABLE.conflicts),
      futureAppointments: unavailableMetric("count", UNAVAILABLE.futureAppointments),
      modifiedOccurrences: metric(modifiedOccurrences),
      recurrenceSeries: metric(series.recurrenceSeries),
      replacementAppointments: unavailableMetric("count", UNAVAILABLE.replacementAppointments),
      scheduledDurationMinutes: unavailableMetric(
        "minutes",
        UNAVAILABLE.scheduledDurationMinutes,
      ),
      totalAppointments: unavailableMetric("count", UNAVAILABLE.totalAppointments),
    }),
    metadata: Object.freeze({
      aggregation: "DATABASE",
      operationalRowsIncluded: false,
      queryCount: 2,
      unitAuthorizationScope: "SYSTEM_MANAGEMENT",
    }),
    readOnly: true,
    source: Object.freeze({
      tables: Object.freeze(["agenda_recurrence_series", "agenda_recurrence_exceptions"]),
      type: "MYSQL_AGGREGATE_READ_ONLY",
    }),
    timeline: Object.freeze(timeline),
    warnings: Object.freeze([
      "RECURRENCE_OCCURRENCES_NOT_MATERIALIZED",
      "AGENDA_DATE_COLUMNS_HAVE_NO_DEDICATED_INDEX",
    ]),
  });
}

function toTimelinePoint(input = {}) {
  return Object.freeze({
    cancelledOccurrences: count(input.cancelledOccurrences),
    date: input.date == null ? null : String(input.date),
    modifiedOccurrences: count(input.modifiedOccurrences),
  });
}

function metric(value, unit = "count") {
  return Object.freeze({
    available: true,
    reason: null,
    unit,
    value: unit === "count" ? count(value) : finiteNonNegative(value),
  });
}

function unavailableMetric(unit, reason) {
  return Object.freeze({ available: false, reason, unit, value: null });
}

function count(value) {
  return Math.trunc(finiteNonNegative(value));
}

function finiteNonNegative(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = { UNAVAILABLE, createBiAgendaDto };
