const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  FINANCIAL_BREAKDOWNS_SQL,
  FINANCIAL_EVOLUTION_SQL,
  FINANCIAL_KPIS_SQL,
  MySqlBiFinancialRepository,
  breakdownParams,
  evolutionParams,
  kpiParams,
} = require("./mysql-bi-financial.repository.js");

test("financial repository uses three parameterized aggregate reads without N+1", async () => {
  const calls = [];
  const repository = new MySqlBiFinancialRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [[{}]];
    },
  });
  await repository.getFinancialAnalytics({
    current: period("2026-07-01", "2026-07-31", "1"),
    previous: period("2026-06-01", "2026-06-30", "1"),
  });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ sql }) => /SUM\(|COUNT\(/.test(sql)));
  assert.ok(calls.every(({ sql }) => !/\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql)));
  assert.equal((FINANCIAL_KPIS_SQL.match(/\?/g) || []).length, calls[0].params.length);
});

test("financial repository prevents duplicate value sources by reading charges only", () => {
  const sql = `${FINANCIAL_KPIS_SQL} ${FINANCIAL_EVOLUTION_SQL} ${FINANCIAL_BREAKDOWNS_SQL}`;
  assert.match(sql, /j12_financeiro_cobrancas/);
  assert.doesNotMatch(
    sql,
    /j12_mensalidades|j12_pagamentos|financial_payments|enrollment_financial_obligations/,
  );
  assert.doesNotMatch(sql, /pix_payload|pix_copy_paste|qr_code|e2eid|inter_transaction_id/);
});

test("financial repository uses indexed generated columns for normalized filters", () => {
  const sql = `${FINANCIAL_KPIS_SQL} ${FINANCIAL_EVOLUTION_SQL} ${FINANCIAL_BREAKDOWNS_SQL}`;
  assert.match(sql, /c\.status_normalized/);
  assert.match(sql, /c\.type_normalized/);
  assert.match(sql, /c\.payment_effective_date/);
  assert.doesNotMatch(sql, /LOWER\(c\.(?:status|tipo)\)/);
  assert.doesNotMatch(sql, /COALESCE\(c\.data_pagamento\s*,\s*c\.pago_em\)/);
});

test("financial breakdowns reuse one filtered charge set", () => {
  assert.match(FINANCIAL_BREAKDOWNS_SQL, /WITH filtered_charges AS/);
  assert.equal((FINANCIAL_BREAKDOWNS_SQL.match(/FROM j12_financeiro_cobrancas/g) || []).length, 1);
  assert.equal((FINANCIAL_BREAKDOWNS_SQL.match(/FROM filtered_charges/g) || []).length, 4);
});

test("financial repository maps decimals, NULL and every analytical dimension", async () => {
  let call = 0;
  const repository = new MySqlBiFinancialRepository({
    async queryRunner() {
      call += 1;
      if (call === 1)
        return [
          [{ received_revenue: "120.50", paying_students: "2", previous_received_revenue: null }],
        ];
      if (call === 2) return [[{ period: "2026-07", received_revenue: "120.50" }]];
      return [
        [
          { dimension: "category", dimension_key: "mensalidade", quantity: "2", value: "120.50" },
          { dimension: "paymentMethod", dimension_key: "pix", quantity: "1", value: "70" },
        ],
      ];
    },
  });
  const result = await repository.getFinancialAnalytics({
    current: period("2026-07-01", "2026-07-31"),
    previous: period("2026-06-01", "2026-06-30"),
  });
  assert.equal(result.current.receivedRevenue, 120.5);
  assert.equal(result.previous.receivedRevenue, 0);
  assert.deepEqual(result.categories[0], { category: "mensalidade", quantity: 2, value: 120.5 });
  assert.deepEqual(result.paymentMethods[0], { paymentMethod: "pix", quantity: 1, value: 70 });
});

test("financial SQL params cover periods, statuses and optional unit", () => {
  const current = period("2026-07-01", "2026-07-31", "9");
  const previous = period("2026-06-01", "2026-06-30", "9");
  assert.equal(kpiParams(current, previous).length, (FINANCIAL_KPIS_SQL.match(/\?/g) || []).length);
  assert.equal(
    evolutionParams(current).length,
    (FINANCIAL_EVOLUTION_SQL.match(/\?/g) || []).length,
  );
  assert.equal(
    breakdownParams(current).length,
    (FINANCIAL_BREAKDOWNS_SQL.match(/\?/g) || []).length,
  );
  assert.ok(kpiParams(current, previous).includes("9"));
});

function period(startDate, endDate, unitId = null) {
  return { endDate, startDate, unitId };
}
