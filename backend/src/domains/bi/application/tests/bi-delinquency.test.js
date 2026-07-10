const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiDelinquencyService } = require("../index.js");
test("delinquency BI calculates rates and recovery", async () => {
  const result = await service({
    kpis: {
      overdue_value: 300,
      overdue_obligations: 3,
      unique_debtors: 2,
      eligible_value: 1000,
      recovered_value: 200,
      recovered_obligations: 1,
    },
  }).getAnalytics();
  assert.equal(result.kpis.delinquencyRate.value, 30);
  assert.equal(result.kpis.recoveryRate.value, 40);
  assert.equal(result.kpis.uniqueDebtors.value, 2);
});
test("zero portfolio leaves rates unavailable without NaN", async () => {
  const result = await service({}).getAnalytics();
  assert.equal(result.kpis.delinquencyRate.value, null);
  assert.equal(result.kpis.recoveryRate.available, false);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
});
test("aging and status values are normalized without PII", async () => {
  const result = await service({
    aging: [{ bucket: "1-7", quantity: "2", value: "50.25" }],
    statuses: [{ status: "atrasado", quantity: 2, value: 50 }],
  }).getAnalytics();
  assert.equal(result.aging[0].value, 50.25);
  assert.doesNotMatch(JSON.stringify(result), /nome_aluno|cpf|telefone|email/i);
});
test("service validates custom period and repository", async () => {
  await assert.rejects(() => service({}).getAnalytics({ period: "CUSTOM" }), {
    code: "BI_PERIOD_INVALID",
  });
  await assert.rejects(() => new BiDelinquencyService({ repository: {} }).getAnalytics(), {
    code: "BI_REPOSITORY_INVALID",
  });
});
function service(data) {
  return new BiDelinquencyService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getDelinquencyAnalytics() {
        return data;
      },
    },
  });
}
