const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiInsightEngine } = require("../index.js");

const timestamp = "2026-07-10T12:00:00.000Z";
test("engine applies thresholds, severities and priority without claiming causality", () => {
  const insights = engine().generate({
    classes: {
      filters: filters(),
      table: [
        { active: true, capacityValid: true, classId: "1", className: "Sub-12", occupancyRate: 96 },
        { active: true, capacityValid: true, classId: "2", className: "Base", occupancyRate: 20 },
      ],
    },
    courts: { filters: filters(), kpis: { occupancyRate: metric(15) } },
    delinquency: { filters: filters(), kpis: { delinquencyRate: metric(22) } },
    financial: financial(-30, 700, 1000),
    generatedAt: timestamp,
    students: students(-5),
  });
  assert.equal(insights[0].severity, "critical");
  assert.deepEqual(
    new Set(insights.map((item) => item.severity)),
    new Set(["critical", "warning", "info"]),
  );
  assert.ok(
    insights.every(
      (item) => item.id && item.dataSource && item.timestamp === timestamp && item.action,
    ),
  );
  assert.ok(insights.every((item) => !/causad|devido a/i.test(item.description)));
});

test("engine avoids false positives at safe thresholds and with missing data", () => {
  const insights = engine().generate({
    classes: { table: [] },
    courts: { kpis: { occupancyRate: metric(50) } },
    delinquency: { kpis: { delinquencyRate: metric(5) } },
    financial: financial(2, 102, 100),
    generatedAt: timestamp,
    students: students(0),
  });
  assert.deepEqual(insights, []);
  assert.deepEqual(engine().generate({ generatedAt: timestamp }), []);
});

test("engine supports configured thresholds and zero references remain absent", () => {
  const custom = new BiInsightEngine({ thresholds: { warningDelinquencyRate: 5 } });
  assert.equal(
    custom.generate({
      delinquency: { kpis: { delinquencyRate: metric(6) } },
      generatedAt: timestamp,
    }).length,
    1,
  );
  const zero = financial(null, 10, 0);
  zero.insights.currentVsPrevious.available = false;
  assert.deepEqual(engine().generate({ financial: zero, generatedAt: timestamp }), []);
});
function engine() {
  return new BiInsightEngine();
}
function metric(value) {
  return { available: true, value };
}
function filters() {
  return {
    current: { endDate: "2026-07-31", startDate: "2026-07-01", timezone: "America/Sao_Paulo" },
  };
}
function financial(percent, currentValue, previousValue) {
  return {
    filters: filters(),
    insights: {
      currentVsPrevious: { available: percent !== null, currentValue, percent, previousValue },
    },
  };
}
function students(percent) {
  return {
    filters: filters(),
    kpis: {
      newStudents: { comparison: { available: true, percent, previousValue: 10 }, value: 9 },
    },
  };
}
