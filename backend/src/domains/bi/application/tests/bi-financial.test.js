const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiFinancialService } = require("../index.js");

test("financial BI calculates metrics, ticket and equal previous period", async () => {
  let input;
  const service = new BiFinancialService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getFinancialAnalytics(value) {
        input = value;
        return analytics();
      },
    },
  });
  const result = await service.getAnalytics({
    endDate: "2026-07-10",
    period: "CUSTOM",
    startDate: "2026-07-01",
    unitId: "2",
  });
  assert.deepEqual(input.previous, {
    endDate: "2026-06-30",
    startDate: "2026-06-21",
    timezone: "America/Sao_Paulo",
    unitId: "2",
  });
  assert.equal(result.contractVersion, "21.3");
  assert.equal(result.kpis.averageTicket.value, 100);
  assert.equal(result.kpis.receivedRevenue.comparison.percent, 100);
  assert.equal(result.evolution[0].receivedRevenue, 1000);
  assert.deepEqual(result.breakdowns.paymentMethods[0], {
    key: "pix",
    quantity: 7,
    value: 700,
  });
});

test("financial BI treats zero denominators and previous zero explicitly", async () => {
  const service = serviceWith({
    current: { payingStudents: 0, receivedRevenue: 0 },
    previous: { payingStudents: 0, receivedRevenue: 0 },
  });
  const { kpis } = await service.getAnalytics();
  assert.equal(kpis.averageTicket.available, false);
  assert.equal(kpis.averageTicket.value, null);
  assert.equal(kpis.receivedRevenue.comparison.available, false);
  assert.equal(kpis.receivedRevenue.comparison.reason, "PREVIOUS_VALUE_ZERO");
});

test("financial BI normalizes empty repository data without NaN or Infinity", async () => {
  const result = await serviceWith({}).getAnalytics();
  assert.equal(result.kpis.expectedRevenue.value, 0);
  assert.equal(result.evolution.length, 0);
  assert.equal(JSON.stringify(result).includes("NaN"), false);
  assert.equal(JSON.stringify(result).includes("Infinity"), false);
});

test("financial BI validates filters, clock and repository dependency", async () => {
  await assert.rejects(() => serviceWith({}).getAnalytics({ period: "CUSTOM" }), {
    code: "BI_PERIOD_INVALID",
  });
  await assert.rejects(
    () =>
      new BiFinancialService({
        now: () => "invalid",
        repository: { getFinancialAnalytics() {} },
      }).getAnalytics(),
    { code: "BI_CLOCK_INVALID" },
  );
  await assert.rejects(() => new BiFinancialService({ repository: {} }).getAnalytics(), {
    code: "BI_REPOSITORY_INVALID",
  });
});

function serviceWith(value) {
  return new BiFinancialService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getFinancialAnalytics() {
        return value;
      },
    },
  });
}
function analytics() {
  return {
    categories: [{ category: "mensalidade", quantity: 10, value: 1000 }],
    current: {
      expenses: 100,
      expectedRevenue: 1500,
      overdueRevenue: 200,
      payingStudents: 10,
      pendingRevenue: 300,
      receivedRevenue: 1000,
    },
    evolution: [{ period: "2026-07", receivedRevenue: 1000 }],
    modalities: [{ modality: "futsal", quantity: 10, value: 1000 }],
    paymentMethods: [{ paymentMethod: "pix", quantity: 7, value: 700 }],
    previous: {
      expenses: 50,
      expectedRevenue: 1000,
      overdueRevenue: 100,
      payingStudents: 5,
      pendingRevenue: 150,
      receivedRevenue: 500,
    },
    units: [{ unit: "centro", quantity: 10, value: 1000 }],
  };
}
