const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MySqlFinancialReportRepository,
  buildChargeWhere,
} = require("./mysql-financial-report.repository.js");

test("buildChargeWhere parameterizes every supported filter", () => {
  const result = buildChargeWhere(
    {
      category: "mensalidade",
      from: "2026-07-01",
      modality: "Futebol",
      professor: "Professor Mock",
      status: "pago",
      to: "2026-07-31",
      turma: "Turma A",
      unit: "Centro",
    },
    "c",
  );

  assert.match(result.sql, /BETWEEN \? AND \?/);
  assert.match(result.sql, /c\.unidade = \?/);
  assert.match(result.sql, /t\.professor_nome = \?/);
  assert.equal(result.sql.includes("Professor Mock"), false);
  assert.deepEqual(result.params, [
    "2026-07-01",
    "2026-07-31",
    "Centro",
    "Futebol",
    "Turma A",
    "mensalidade",
    "Professor Mock",
    "Professor Mock",
    "pago",
  ]);
});

test("MySqlFinancialReportRepository uses aggregate queries and bounded pagination", async () => {
  const calls = [];
  const repository = new MySqlFinancialReportRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql: sql.replace(/\s+/g, " ").trim() });
      if (/COUNT\(\*\) total/.test(sql)) return [[{ total: 2 }]];
      if (/GROUP BY LOWER\(c\.status\)/.test(sql))
        return [[{ quantidade: 2, status: "pago", valor: 300 }]];
      return [[{ id: "mock-row" }]];
    },
  });
  const result = await repository.getInstallmentsReport({
    from: "2026-07-01",
    limit: 10,
    offset: 10,
    page: 2,
    to: "2026-07-31",
  });

  assert.equal(result.count, 2);
  assert.equal(calls.length, 3);
  assert.ok(calls.some((call) => /GROUP BY/.test(call.sql)));
  assert.ok(
    calls.some(
      (call) =>
        /LIMIT \? OFFSET \?/.test(call.sql) &&
        call.params.at(-2) === 10 &&
        call.params.at(-1) === 10,
    ),
  );
});

test("financial overview executes a fixed aggregate query set without N+1", async () => {
  const calls = [];
  const repository = new MySqlFinancialReportRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.getFinancialOverview({ from: "2026-07-01", to: "2026-07-31" });

  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => /SUM\(|COUNT\(/.test(call.sql)));
  assert.equal(calls[3].params.length, 6);
});
