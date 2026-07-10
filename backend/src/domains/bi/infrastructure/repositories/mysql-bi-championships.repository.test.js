const assert = require("node:assert/strict");
const { test } = require("node:test");
const repositoryModule = require("./mysql-bi-championships.repository.js");
test("championship BI repository uses four parameterized read-only queries", async () => {
  const calls = [];
  const repository = new repositoryModule.MySqlBiChampionshipsRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.getChampionshipAnalytics({
    current: { startDate: "2026-07-01", endDate: "2026-07-31" },
  });
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.params.length, (call.sql.match(/\?/g) || []).length);
    assert.doesNotMatch(call.sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
  }
});
test("championship BI SQL excludes soft-deleted data and personal participant fields", () => {
  const sql = Object.values(repositoryModule)
    .filter((value) => typeof value === "string")
    .join("\n");
  assert.match(sql, /deleted_at IS NULL/);
  assert.doesNotMatch(sql, /\b(?:document|birth_date|responsible|coach|email|phone)\b/i);
});
