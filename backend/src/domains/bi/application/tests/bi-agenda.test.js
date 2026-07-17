const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiAgendaService } = require("../index.js");

test("Agenda BI returns a deterministic aggregate contract without operational rows or PII", async () => {
  const result = await service({
    cancelledOccurrences: 2,
    modifiedOccurrences: 3,
    series: { activeSeries: 4, cancelledSeries: 1, recurrenceSeries: 5 },
    timeline: [{ cancelledOccurrences: 2, date: "2026-07-10", modifiedOccurrences: 3 }],
  }).getAnalytics({ unitId: "9" });

  assert.equal(result.contractVersion, "21.12");
  assert.equal(result.readOnly, true);
  assert.equal(result.generatedAt, "2026-07-10T12:00:00.000Z");
  assert.equal(result.filters.current.unitId, "9");
  assert.equal(result.filters.current.timezone, "America/Sao_Paulo");
  assert.equal(result.kpis.recurrenceSeries.value, 5);
  assert.equal(result.kpis.cancellationRate.value, 40);
  assert.equal(result.kpis.totalAppointments.available, false);
  assert.equal(result.metadata.operationalRowsIncluded, false);
  assert.equal(result.timeline.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /student|professor|phone|email|cpf|address|name/i);
});

test("Agenda BI normalizes empty and invalid aggregate values without NaN or Infinity", async () => {
  const result = await service({
    cancelledOccurrences: Number.NaN,
    modifiedOccurrences: Number.POSITIVE_INFINITY,
    series: {},
  }).getAnalytics();

  assert.equal(result.kpis.cancelledOccurrences.value, 0);
  assert.equal(result.kpis.modifiedOccurrences.value, 0);
  assert.equal(result.kpis.cancellationRate.available, false);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
});

test("Agenda BI preserves decimal cancellation rates", async () => {
  const result = await service({
    cancelledOccurrences: 2,
    modifiedOccurrences: 1,
    series: {},
  }).getAnalytics();
  assert.equal(result.kpis.cancellationRate.value, 66.67);
});

test("Agenda BI validates canonical custom periods and repository dependency", async () => {
  let received;
  const instance = new BiAgendaService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getAgendaAnalytics(input) {
        received = input;
        return {};
      },
    },
  });
  await instance.getAnalytics({
    endDate: "2026-07-10",
    period: "CUSTOM",
    startDate: "2026-07-01",
  });
  assert.equal(received.current.startDate, "2026-07-01");
  await assert.rejects(
    () => instance.getAnalytics({ endDate: "2026-07-01", period: "CUSTOM", startDate: "invalid" }),
    { code: "BI_PERIOD_INVALID" },
  );
  await assert.rejects(() => new BiAgendaService({ repository: {} }).getAnalytics(), {
    code: "BI_REPOSITORY_INVALID",
  });
});

function service(analytics) {
  return new BiAgendaService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getAgendaAnalytics() {
        return analytics;
      },
    },
  });
}
