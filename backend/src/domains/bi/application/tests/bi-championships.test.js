const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiChampionshipsService } = require("../index.js");

test("championship BI calculates statuses, categories and multiple competitions", async () => {
  const result = await service({
    championships: [champ("c1", "PUBLISHED", "Sub-15"), champ("c2", "ARCHIVED", "Adulto")],
    matches: [match("c1", "FINISHED"), match("c2", "SCHEDULED"), match("c2", "CANCELLED")],
    participants: 18,
    registrations: [registration("r1", "c1", "t1"), registration("r2", "c2", "t2")],
  }).getAnalytics(custom());
  assert.equal(result.kpis.activeChampionships.value, 1);
  assert.equal(result.kpis.completedChampionships.value, 1);
  assert.equal(result.kpis.finishedMatches.value, 1);
  assert.equal(result.kpis.pendingMatches.value, 1);
  assert.equal(result.kpis.participants.value, 18);
  assert.equal(result.rankings.categories.length, 2);
  assert.equal(result.kpis.registrationRevenue.available, false);
});
test("empty championship BI is finite and explicit", async () => {
  const result = await service({
    championships: [],
    matches: [],
    participants: 0,
    registrations: [],
  }).getAnalytics(custom());
  assert.equal(result.kpis.averageTeams.available, false);
  assert.equal(result.kpis.averageTeams.value, null);
  assert.equal(JSON.stringify(result).includes("NaN"), false);
  assert.equal(JSON.stringify(result).includes("Infinity"), false);
});
test("only confirmed registrations count teams and inscriptions", async () => {
  const result = await service({
    championships: [champ("c1", "PUBLISHED", "Adulto")],
    matches: [],
    participants: 0,
    registrations: [
      registration("r1", "c1", "t1"),
      { ...registration("r2", "c1", "t2"), status: "CANCELLED" },
    ],
  }).getAnalytics(custom());
  assert.equal(result.kpis.registrations.value, 1);
  assert.equal(result.kpis.teams.value, 1);
});
function service(data) {
  return new BiChampionshipsService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getChampionshipAnalytics() {
        return data;
      },
    },
  });
}
function custom() {
  return { period: "CUSTOM", startDate: "2026-07-01", endDate: "2026-07-31" };
}
function champ(id, status, category) {
  return { id, name: `Copa ${id}`, status, category };
}
function match(championship_id, status) {
  return { id: `${championship_id}-${status}`, championship_id, status };
}
function registration(id, championship_id, team_id) {
  return { id, championship_id, team_id, status: "CONFIRMED", created_at: "2026-07-05 10:00:00" };
}
