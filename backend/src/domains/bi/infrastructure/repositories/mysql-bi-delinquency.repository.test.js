const assert = require("node:assert/strict");
const { test } = require("node:test");
const repo = require("./mysql-bi-delinquency.repository.js");
test("delinquency repository runs four parallel parameterized reads", async () => {
  const calls = [];
  const repository = new repo.MySqlBiDelinquencyRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.getDelinquencyAnalytics({ current: period() });
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.params.length, (call.sql.match(/\?/g) || []).length);
    assert.doesNotMatch(call.sql, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  }
});
test("SQL excludes paid current debt, cancelled and annulled obligations", () => {
  assert.match(repo.DELINQUENCY_KPIS_SQL, /data_pagamento,c\.pago_em\) IS NULL OR[\s\S]*> \?/);
  assert.match(repo.DELINQUENCY_KPIS_SQL, /cancelado[\s\S]*anulado/);
  assert.match(repo.DELINQUENCY_KPIS_SQL, /data_pagamento,c\.pago_em\)>c\.vencimento/);
});
test("aging uses deterministic reference with every required bucket", () => {
  for (const bucket of ["1-7", "8-15", "16-30", "31-60", "61-90", "90+"])
    assert.match(repo.DELINQUENCY_AGING_SQL, new RegExp(bucket.replace("+", "\\+")));
});
function period() {
  return { startDate: "2026-07-01", endDate: "2026-07-31", unitId: "2" };
}
