const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createComparison, createSeriesInsights, unavailableGoal } = require("../index.js");

test("comparison exposes absolute and percentage variation for growth and decline", () => {
  assert.deepEqual(createComparison(150, 100), {
    absolute: 50,
    available: true,
    currentValue: 150,
    percent: 50,
    previousValue: 100,
    reason: null,
    trend: "growth",
  });
  assert.deepEqual(createComparison(-20, -10), {
    absolute: -10,
    available: true,
    currentValue: -20,
    percent: -100,
    previousValue: -10,
    reason: null,
    trend: "decline",
  });
  assert.equal(createComparison(10, 10).trend, "stable");
});

test("comparison treats zero and incomplete data without NaN or Infinity", () => {
  const zero = createComparison(10, 0);
  assert.equal(zero.available, false);
  assert.equal(zero.absolute, 10);
  assert.equal(zero.percent, null);
  assert.equal(zero.reason, "PREVIOUS_VALUE_ZERO");
  assert.equal(createComparison(undefined, 2).reason, "INCOMPLETE_DATA");
});

test("series calculates month, year and three-month moving-average trend", () => {
  const result = createSeriesInsights(
    [
      { period: "2025-03", value: 80 },
      { period: "2026-01", value: 100 },
      { period: "2026-02", value: 130 },
      { period: "2026-03", value: 160 },
    ],
    "value",
  );
  assert.equal(result.monthOverMonth.percent, 23.08);
  assert.equal(result.yearOverYear.percent, 100);
  assert.equal(result.trend.method, "MOVING_AVERAGE_3");
  assert.equal(result.trend.direction, "growth");
  assert.equal(result.movingAverage[0].value, 103.33);
  assert.equal(result.movingAverage[1].value, 130);
});

test("series makes missing comparison periods explicit", () => {
  const result = createSeriesInsights([{ period: "2026-03", value: 10 }], "value");
  assert.equal(result.monthOverMonth.reason, "PREVIOUS_MONTH_UNAVAILABLE");
  assert.equal(result.yearOverYear.reason, "PREVIOUS_YEAR_UNAVAILABLE");
  assert.equal(result.trend.direction, "unavailable");
});

test("goals remain unavailable when canonical persistence does not exist", () => {
  assert.deepEqual(unavailableGoal(), {
    achievedPercent: null,
    actual: null,
    available: false,
    difference: null,
    goal: null,
    reason: "NO_CANONICAL_GOAL_PERSISTENCE",
    status: "unavailable",
  });
});
