const assert = require("node:assert/strict");
const { test } = require("node:test");
const repositoryModule = require("./mysql-bi-events.repository.js");
test("events repository performs four aggregate SELECTs without N+1 or writes", async () => {
  const calls = []; const repository = new repositoryModule.MySqlBiEventsRepository({ async queryRunner(sql, params) { calls.push({ sql, params }); return [[]]; } });
  await repository.getEventAnalytics({ current: { startDate: "2026-07-01", endDate: "2026-07-31" }, today: "2026-07-17" });
  assert.equal(calls.length, 4);
  for (const call of calls) { assert.equal(call.params.length, (call.sql.match(/\?/g) || []).length); assert.match(call.sql, /^SELECT/i); assert.match(call.sql, /COUNT\(|SUM\(|GROUP BY/i); assert.doesNotMatch(call.sql, /\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|CREATE|DROP)\b/i); }
});
test("events SQL excludes operational rows, internal ids and PII", () => {
  const sql = Object.values(repositoryModule).filter((value) => typeof value === "string").join("\n"); assert.match(sql, /j12_campeonatos/); assert.match(sql, /deleted_at IS NULL/); assert.doesNotMatch(sql, /\b(?:id|name|description|email|phone|cpf|participant|student|teacher)\b/i);
});
