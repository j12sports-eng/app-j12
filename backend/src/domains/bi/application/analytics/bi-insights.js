function createComparison(currentInput, previousInput, options = {}) {
  const current = finiteNumber(currentInput);
  const previous = finiteNumber(previousInput);
  if (current === null || previous === null) return unavailableComparison("INCOMPLETE_DATA");
  const absolute = round(current - previous);
  if (previous === 0) {
    return Object.freeze({
      absolute,
      available: false,
      currentValue: current,
      percent: null,
      previousValue: previous,
      reason: "PREVIOUS_VALUE_ZERO",
      trend: "unavailable",
    });
  }
  const percent = round((absolute / Math.abs(previous)) * 100);
  return Object.freeze({
    absolute,
    available: true,
    currentValue: current,
    percent,
    previousValue: previous,
    reason: null,
    trend: direction(absolute, options.stabilityThreshold || 0),
  });
}

function createSeriesInsights(rows = [], valueKey, options = {}) {
  const points = rows
    .map((row) => ({ period: String(row?.period || ""), value: finiteNumber(row?.[valueKey]) }))
    .filter((row) => /^\d{4}-\d{2}$/.test(row.period) && row.value !== null)
    .sort((left, right) => left.period.localeCompare(right.period));
  if (!points.length) return unavailableSeries("INCOMPLETE_DATA");
  const latest = points.at(-1);
  const previousMonth = points.find((point) => point.period === shiftMonth(latest.period, -1));
  const previousYear = points.find((point) => point.period === shiftMonth(latest.period, -12));
  const windowSize = Math.max(2, Math.trunc(options.windowSize || 3));
  const movingAverage = movingAverages(points, windowSize);
  const latestAverage = movingAverage.at(-1)?.value ?? null;
  const previousAverage = movingAverage.at(-2)?.value ?? null;
  const movement =
    latestAverage === null || previousAverage === null
      ? "unavailable"
      : direction(latestAverage - previousAverage, options.stabilityThreshold || 0);
  return Object.freeze({
    available: true,
    latest: Object.freeze({ ...latest }),
    monthOverMonth: previousMonth
      ? createComparison(latest.value, previousMonth.value, options)
      : unavailableComparison("PREVIOUS_MONTH_UNAVAILABLE", latest.value),
    movingAverage: Object.freeze(movingAverage.map((point) => Object.freeze(point))),
    reason: null,
    trend: Object.freeze({
      direction: movement,
      method: `MOVING_AVERAGE_${windowSize}`,
      value: latestAverage,
    }),
    yearOverYear: previousYear
      ? createComparison(latest.value, previousYear.value, options)
      : unavailableComparison("PREVIOUS_YEAR_UNAVAILABLE", latest.value),
  });
}

function unavailableGoal(reason = "NO_CANONICAL_GOAL_PERSISTENCE") {
  return Object.freeze({
    achievedPercent: null,
    actual: null,
    available: false,
    difference: null,
    goal: null,
    reason,
    status: "unavailable",
  });
}

function movingAverages(points, size) {
  if (points.length < size) return [];
  return points.slice(size - 1).map((point, index) => {
    const window = points.slice(index, index + size);
    return {
      period: point.period,
      value: round(window.reduce((sum, item) => sum + item.value, 0) / size),
    };
  });
}
function unavailableSeries(reason) {
  return Object.freeze({
    available: false,
    latest: null,
    monthOverMonth: unavailableComparison(reason),
    movingAverage: Object.freeze([]),
    reason,
    trend: Object.freeze({ direction: "unavailable", method: "MOVING_AVERAGE_3", value: null }),
    yearOverYear: unavailableComparison(reason),
  });
}
function unavailableComparison(reason, currentValue = null) {
  return Object.freeze({
    absolute: null,
    available: false,
    currentValue,
    percent: null,
    previousValue: null,
    reason,
    trend: "unavailable",
  });
}
function shiftMonth(period, amount) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function direction(delta, threshold) {
  if (Math.abs(delta) <= Math.abs(threshold)) return "stable";
  return delta > 0 ? "growth" : "decline";
}
function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function round(value) {
  return Number(value.toFixed(2));
}

module.exports = { createComparison, createSeriesInsights, unavailableGoal };
