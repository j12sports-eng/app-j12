const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiClassesService } = require("../index.js");
test("class BI calculates valid capacity occupancy and vacancies", async () => {
  const result = await service([
    row({ capacity: 10, occupancy: 10 }),
    row({ classId: "2", capacity: 10, occupancy: 2 }),
  ]).getAnalytics();
  assert.equal(result.kpis.activeClasses.value, 2);
  assert.equal(result.kpis.totalCapacity.value, 20);
  assert.equal(result.kpis.enrolledStudents.value, 11);
  assert.equal(result.kpis.occupancyRate.value, 60);
  assert.equal(result.kpis.availableSpots.value, 8);
  assert.equal(result.kpis.fullClasses.value, 1);
  assert.equal(result.kpis.underutilizedClasses.value, 1);
});
test("zero and null capacities never create artificial rates or vacancies", async () => {
  const result = await service([
    row({ capacity: 0, occupancy: 3 }),
    row({ classId: "2", capacity: null, occupancy: 2 }),
  ]).getAnalytics();
  assert.equal(result.kpis.totalCapacity.available, false);
  assert.equal(result.kpis.occupancyRate.value, null);
  assert.equal(result.table[0].availableSpots, null);
  assert.equal(result.table[0].full, false);
});
test("inactive classes do not affect active KPIs and category stays unavailable", async () => {
  const result = await service([
    row({ status: "inativa", capacity: 10, occupancy: 10 }),
  ]).getAnalytics();
  assert.equal(result.kpis.activeClasses.value, 0);
  assert.equal(result.dimensions.categories.available, false);
  assert.equal(result.dimensions.categories.items, null);
});
test("class BI forwards unit filter and validates dependency", async () => {
  let input;
  const instance = new BiClassesService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getClassOccupancy(value) {
        input = value;
        return [];
      },
    },
  });
  await instance.getAnalytics({ unitId: "9" });
  assert.equal(input.current.unitId, "9");
  await assert.rejects(() => new BiClassesService({ repository: {} }).getAnalytics(), {
    code: "BI_REPOSITORY_INVALID",
  });
});
function service(rows) {
  return new BiClassesService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getClassOccupancy() {
        return { classes: rows, enrolledStudents: 11 };
      },
    },
  });
}
function row(overrides = {}) {
  return {
    capacity: 10,
    classId: "1",
    className: "Sub 12",
    daysOfWeek: ["segunda"],
    endTime: "19:00",
    modality: "Futsal",
    occupancy: 5,
    professorName: "Professor",
    startTime: "18:00",
    status: "ativa",
    unit: "Centro",
    ...overrides,
  };
}
