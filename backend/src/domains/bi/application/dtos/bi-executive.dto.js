function createBiExecutiveDto({ current, filters, generatedAt, previous }) {
  const kpis = {
    activeStudents: metric(
      current.activeStudents,
      "count",
      unavailableComparison("NO_HISTORICAL_SNAPSHOT"),
    ),
    averageTicket: derivedMetric(
      safeDivide(current.receivedRevenue, current.payingStudents),
      "currency",
      safeDivide(previous.receivedRevenue, previous.payingStudents),
      "NO_PAYING_STUDENTS",
    ),
    cancellations: unavailableMetric("count", "NO_CANONICAL_CANCELLATION_TIMESTAMP"),
    delinquencyRate: derivedMetric(
      safePercentage(current.overdueRevenue, current.expectedRevenue),
      "percentage",
      safePercentage(previous.overdueRevenue, previous.expectedRevenue),
      "EXPECTED_REVENUE_ZERO",
    ),
    expectedRevenue: metric(
      current.expectedRevenue,
      "currency",
      comparison(current.expectedRevenue, previous.expectedRevenue),
    ),
    newStudents: metric(
      current.newStudents,
      "count",
      comparison(current.newStudents, previous.newStudents),
    ),
    overdueRevenue: metric(
      current.overdueRevenue,
      "currency",
      comparison(current.overdueRevenue, previous.overdueRevenue),
    ),
    receivedRevenue: metric(
      current.receivedRevenue,
      "currency",
      comparison(current.receivedRevenue, previous.receivedRevenue),
    ),
  };

  return Object.freeze({
    contractVersion: "21.2",
    filters,
    generatedAt,
    kpis: Object.freeze(kpis),
    readOnly: true,
  });
}

function metric(value, unit, metricComparison) {
  return Object.freeze({
    available: true,
    comparison: metricComparison,
    reason: null,
    unit,
    value: number(value),
  });
}

function derivedMetric(current, unit, previous, reason) {
  if (current === null) return unavailableMetric(unit, reason);
  return metric(
    current,
    unit,
    previous === null ? unavailableComparison(reason) : comparison(current, previous),
  );
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

function unavailableComparison(reason) {
  return Object.freeze({
    available: false,
    percent: null,
    previousValue: null,
    reason,
    trend: "unavailable",
  });
}

function comparison(current, previous) {
  const currentValue = number(current);
  const previousValue = number(previous);
  if (previousValue === 0) {
    return Object.freeze({
      available: false,
      percent: null,
      previousValue,
      reason: "PREVIOUS_VALUE_ZERO",
      trend: "unavailable",
    });
  }
  const percent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return Object.freeze({
    available: true,
    percent: Number(percent.toFixed(2)),
    previousValue,
    reason: null,
    trend: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral",
  });
}

function safePercentage(part, total) {
  const denominator = number(total);
  return denominator > 0 ? Number(((number(part) / denominator) * 100).toFixed(2)) : null;
}

function safeDivide(total, count) {
  const denominator = number(count);
  return denominator > 0 ? Number((number(total) / denominator).toFixed(2)) : null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = { createBiExecutiveDto };
