const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiExecutiveService, previousPeriod } = require("../index.js");

test("executive service resolves equal non-overlapping periods and preserves unit", async () => {
  let received;
  const service = new BiExecutiveService({
    now: () => new Date("2026-07-10T15:00:00-03:00"),
    repository: {
      async getExecutiveSnapshot(input) {
        received = input;
        return snapshot();
      },
    },
  });
  const result = await service.getDashboard({
    period: "CUSTOM",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    unitId: "7",
  });
  assert.deepEqual(received.previous, {
    startDate: "2026-06-21",
    endDate: "2026-06-30",
    timezone: "America/Sao_Paulo",
    unitId: "7",
  });
  assert.equal(result.contractVersion, "21.2");
  assert.equal(result.kpis.activeStudents.value, 12);
  assert.equal(result.kpis.activeStudents.comparison.available, false);
  assert.equal(result.kpis.cancellations.available, false);
});

test("executive DTO calculates audited derived KPIs and comparisons", async () => {
  const service = new BiExecutiveService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getExecutiveSnapshot() {
        return snapshot();
      },
    },
  });
  const { kpis } = await service.getDashboard({ period: "LAST_7_DAYS" });
  assert.equal(kpis.averageTicket.value, 100);
  assert.equal(kpis.delinquencyRate.value, 20);
  assert.equal(kpis.receivedRevenue.comparison.percent, 100);
  assert.equal(kpis.newStudents.comparison.percent, 100);
});

test("zero denominators and previous zero remain explicitly unavailable", async () => {
  const service = new BiExecutiveService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getExecutiveSnapshot() {
        return {
          current: {
            activeStudents: 0,
            expectedRevenue: 0,
            newStudents: 1,
            overdueRevenue: 0,
            payingStudents: 0,
            receivedRevenue: 0,
          },
          previous: {
            expectedRevenue: 0,
            newStudents: 0,
            overdueRevenue: 0,
            payingStudents: 0,
            receivedRevenue: 0,
          },
        };
      },
    },
  });
  const { kpis } = await service.getDashboard();
  assert.equal(kpis.averageTicket.available, false);
  assert.equal(kpis.delinquencyRate.available, false);
  assert.equal(kpis.newStudents.comparison.available, false);
  assert.equal(kpis.newStudents.comparison.reason, "PREVIOUS_VALUE_ZERO");
});

test("service rejects invalid filters, clock and repository", async () => {
  await assert.rejects(() => new BiExecutiveService({ repository: {} }).getDashboard(), {
    code: "BI_REPOSITORY_INVALID",
  });
  await assert.rejects(
    () =>
      new BiExecutiveService({
        now: () => "invalid",
        repository: { getExecutiveSnapshot() {} },
      }).getDashboard(),
    { code: "BI_CLOCK_INVALID" },
  );
  await assert.rejects(
    () =>
      new BiExecutiveService({ repository: { getExecutiveSnapshot() {} } }).getDashboard({
        period: "CUSTOM",
      }),
    { code: "BI_PERIOD_INVALID" },
  );
});

test("previousPeriod handles month boundaries without overlap", () => {
  assert.deepEqual(
    previousPeriod({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      timezone: "America/Sao_Paulo",
      unitId: null,
    }),
    { startDate: "2026-01-29", endDate: "2026-02-28", timezone: "America/Sao_Paulo", unitId: null },
  );
});

function snapshot() {
  return {
    current: {
      activeStudents: 12,
      expectedRevenue: 1000,
      newStudents: 4,
      overdueRevenue: 200,
      payingStudents: 10,
      receivedRevenue: 1000,
    },
    previous: {
      expectedRevenue: 800,
      newStudents: 2,
      overdueRevenue: 100,
      payingStudents: 5,
      receivedRevenue: 500,
    },
  };
}
