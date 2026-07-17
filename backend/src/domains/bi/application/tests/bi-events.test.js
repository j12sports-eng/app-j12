const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiEventsService } = require("../index.js");
test("events BI returns read-only aggregate contract without PII", async () => {
  const result = await service({ summary: { totalEvents: 4, publishedEvents: 2, completedEvents: 1, upcomingEvents: 1 }, monthlyEvolution: [{ period: "2026-07", events: 4 }], eventsByType: [{ type: "Futsal", events: 4 }] }).getAnalytics(custom());
  assert.equal(result.version, "27.12"); assert.equal(result.source, "j12_campeonatos"); assert.equal(result.readOnly, true);
  assert.equal(result.kpis.totalEvents.value, 4); assert.equal(result.kpis.cancelledEvents.available, false); assert.deepEqual(result.dimensions.eventsByUnit, []);
  assert.doesNotMatch(JSON.stringify(result), /email|phone|cpf|participant|professor|aluno/i);
});
test("events BI handles empty payload and rejects unsupported unitId", async () => {
  const instance = service({}); const result = await instance.getAnalytics(custom());
  assert.equal(result.kpis.totalEvents.value, 0); assert.equal(result.kpis.scheduledEvents.value, null); assert.deepEqual(result.dimensions.monthlyEvolution, []);
  await assert.rejects(() => instance.getAnalytics({ ...custom(), unitId: "1" }), (error) => error.code === "BI_FILTER_INVALID" && error.details.field === "unitId");
});
function service(data) { return new BiEventsService({ now: () => new Date("2026-07-17T12:00:00Z"), repository: { async getEventAnalytics() { return data; } } }); }
function custom() { return { period: "CUSTOM", startDate: "2026-07-01", endDate: "2026-07-31" }; }
