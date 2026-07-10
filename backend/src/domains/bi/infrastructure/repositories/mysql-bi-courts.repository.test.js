const assert = require("node:assert/strict");
const { test } = require("node:test");
const r = require("./mysql-bi-courts.repository.js");
test("court repository runs two parallel parameterized reads", async () => {
  const calls = [];
  const repository = new r.MySqlBiCourtsRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.getCourtAnalytics({
    current: { startDate: "2026-07-01", endDate: "2026-07-31", unitId: "u" },
  });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.params.length, (c.sql.match(/\?/g) || []).length);
    assert.doesNotMatch(c.sql, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  }
});
test("reservation SQL preserves recurrence cancellation payment and financial link fields", () => {
  for (const field of [
    "recurrence_group_id",
    "status",
    "payment_status",
    "financial_charge_id",
    "start_at",
    "end_at",
  ])
    assert.match(r.RESERVATIONS_SQL, new RegExp(field));
});
