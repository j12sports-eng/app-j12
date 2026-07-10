const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiCourtsService } = require("../index.js");
test("court BI merges overlaps and keeps ambiguous revenue unavailable", async () => {
  const result = await service({
    courts: [court()],
    reservations: [
      res({ id: "1", start_at: "2026-07-06 08:00:00", end_at: "2026-07-06 10:00:00" }),
      res({
        id: "2",
        start_at: "2026-07-06 09:00:00",
        end_at: "2026-07-06 11:00:00",
        final_value: 200,
      }),
    ],
  }).getAnalytics(custom());
  assert.equal(result.kpis.reservedHours.value, 3);
  assert.equal(result.kpis.rentalRevenue.available, false);
  assert.equal(result.kpis.rentalRevenue.value, null);
  assert.equal(result.kpis.ticketAverage.available, false);
  assert.equal(result.rankings.courts[0].revenue, null);
});
test("cancelled reservations do not occupy or generate revenue", async () => {
  const result = await service({
    courts: [court()],
    reservations: [res({ status: "cancelled", payment_status: "paid" })],
  }).getAnalytics(custom());
  assert.equal(result.kpis.reservedHours.value, 0);
  assert.equal(result.kpis.cancellations.value, 1);
  assert.equal(result.kpis.rentalRevenue.available, false);
  assert.equal(result.kpis.rentalRevenue.value, null);
});
test("full overlaps, adjacent slots and separate courts use real occupied minutes", async () => {
  const result = await service({
    courts: [court(), { ...court(), id: "c2", nome: "Anexo" }],
    reservations: [
      res({ id: "1", start_at: "2026-07-06 08:00:00", end_at: "2026-07-06 10:00:00" }),
      res({ id: "2", start_at: "2026-07-06 08:30:00", end_at: "2026-07-06 09:00:00" }),
      res({ id: "3", start_at: "2026-07-06 10:00:00", end_at: "2026-07-06 11:00:00" }),
      res({
        id: "4",
        quadra_id: "c2",
        start_at: "2026-07-06 08:00:00",
        end_at: "2026-07-06 09:00:00",
      }),
    ],
  }).getAnalytics(custom());
  assert.equal(result.kpis.reservedHours.value, 4);
  assert.equal(result.kpis.availableHours.value, 8);
  assert.equal(result.kpis.occupancyRate.value, 50);
});
test("inactive courts do not create fictitious availability", async () => {
  const result = await service({
    courts: [{ ...court(), status: "manutencao" }],
    reservations: [],
  }).getAnalytics(custom());
  assert.equal(result.kpis.availableHours.value, 0);
  assert.equal(result.kpis.occupancyRate.available, false);
  assert.deepEqual(result.rankings.courts, []);
});
test("recurring materialized occurrences remain distinct", async () => {
  const result = await service({
    courts: [court()],
    reservations: [
      res({ id: "1", recurrence_group_id: "g" }),
      res({
        id: "2",
        recurrence_group_id: "g",
        start_at: "2026-07-07 08:00:00",
        end_at: "2026-07-07 09:00:00",
      }),
    ],
  }).getAnalytics(custom());
  assert.equal(
    result.rankings.days.reduce((s, r) => s + r.reservations, 0),
    2,
  );
});
test("period timezone and missing availability are deterministic", async () => {
  const result = await service({
    courts: [{ ...court(), funcionamento_json: "{}" }],
    reservations: [],
  }).getAnalytics(custom());
  assert.equal(result.kpis.occupancyRate.available, false);
  assert.equal(result.filters.current.timezone, "America/Sao_Paulo");
});
function service(data) {
  return new BiCourtsService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getCourtAnalytics() {
        return data;
      },
    },
  });
}
function custom() {
  return { period: "CUSTOM", startDate: "2026-07-06", endDate: "2026-07-12" };
}
function court() {
  return {
    id: "c1",
    nome: "Central",
    status: "ativa",
    unidade: "Centro",
    funcionamento_json: JSON.stringify({ seg: [{ start: "08:00", end: "12:00" }] }),
  };
}
function res(o = {}) {
  return {
    id: "r",
    quadra_id: "c1",
    start_at: "2026-07-06 08:00:00",
    end_at: "2026-07-06 09:00:00",
    status: "confirmed",
    payment_status: "paid",
    final_value: 100,
    ...o,
  };
}
