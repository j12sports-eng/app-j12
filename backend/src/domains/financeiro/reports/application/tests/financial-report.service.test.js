const assert = require("node:assert/strict");
const test = require("node:test");

const { FinancialReportService } = require("../services/financial-report.service.js");
const { FINANCIAL_REPORT_FILTER_INVALID } = require("../validators/financial-report.validators.js");

test("FinancialReportService calculates financial balance and dimension revenues", async () => {
  const service = createService();
  const report = await service.getFinancial(baseFilters());

  assert.equal(report.report, "financeiro");
  assert.equal(report.receitas, 1250.5);
  assert.equal(report.despesas, 250.25);
  assert.equal(report.saldo, 1000.25);
  assert.equal(report.fluxoCaixa[0].saldo, 800);
  assert.deepEqual(report.professores, [{ nome: "Professor Mock", receita: 500 }]);
  assert.deepEqual(report.turmas, [{ nome: "Turma Mock", receita: 600 }]);
  assert.deepEqual(report.modalidades, [{ nome: "Futebol", receita: 700 }]);
});

test("FinancialReportService maps installments, pagination and renegotiated status", async () => {
  const report = await createService().getInstallments({ ...baseFilters(), limit: 10, page: 2 });

  assert.equal(report.pagas.quantidade, 2);
  assert.equal(report.vencidas.quantidade, 2);
  assert.equal(report.renegociadas.quantidade, 1);
  assert.deepEqual(report.pagination, { limit: 10, page: 2, total: 21, totalPages: 3 });
});

test("FinancialReportService calculates delinquency percentage", async () => {
  const report = await createService().getDelinquency(baseFilters());

  assert.equal(report.alunosInadimplentes, 3);
  assert.equal(report.valor, 250);
  assert.equal(report.percentual, 25);
});

test("FinancialReportService maps PIX and automation aggregates", async () => {
  const service = createService();
  const pix = await service.getPix(baseFilters());
  const automations = await service.getAutomations(baseFilters());

  assert.equal(pix.emitidos, 5);
  assert.equal(pix.pagos.quantidade, 3);
  assert.equal(pix.conciliacoes, 2);
  assert.equal(automations.lembretesEnviados, 4);
  assert.equal(automations.pagamentosConfirmados, 2);
  assert.equal(automations.falhas, 1);
});

test("FinancialReportService builds consolidated report without N+1 service calls", async () => {
  const calls = [];
  const service = createService(calls);
  const report = await service.getConsolidated(baseFilters());

  assert.equal(report.report, "all");
  assert.deepEqual(calls.sort(), [
    "automations",
    "delinquency",
    "financial",
    "installments",
    "pix",
  ]);
});

test("FinancialReportService rejects invalid periods", async () => {
  await assert.rejects(createService().getFinancial({ from: "invalid", to: "2026-07-09" }), {
    code: FINANCIAL_REPORT_FILTER_INVALID,
  });
});

function createService(calls = []) {
  return new FinancialReportService({
    now: () => new Date("2026-07-09T12:00:00.000Z"),
    repository: {
      async getFinancialOverview() {
        calls.push("financial");
        return {
          cashFlow: [{ despesas: 200, periodo: "2026-07", receitas: 1000 }],
          categories: [
            { categoria: "mensalidade", natureza: "receita", quantidade: 5, valor: 1250.5 },
          ],
          dimensions: [
            { dimensao: "professor", nome: "Professor Mock", receita: 500 },
            { dimensao: "turma", nome: "Turma Mock", receita: 600 },
            { dimensao: "modalidade", nome: "Futebol", receita: 700 },
          ],
          totals: { despesas: 250.25, receitas: 1250.5 },
        };
      },
      async getInstallmentsReport() {
        calls.push("installments");
        return {
          count: 21,
          items: [{ id: "mock-1" }],
          summary: [
            { quantidade: 2, status: "pago", valor: 200 },
            { quantidade: 1, status: "atrasado", valor: 100 },
            { quantidade: 1, status: "vencido", valor: 80 },
            { quantidade: 1, status: "renegociado", valor: 90 },
          ],
        };
      },
      async getDelinquencyReport() {
        calls.push("delinquency");
        return {
          count: 3,
          evolution: [],
          items: [],
          portfolioValue: 1000,
          summary: { alunos_inadimplentes: 3, mensalidades: 4, valor: 250 },
        };
      },
      async getPixReport() {
        calls.push("pix");
        return {
          count: 5,
          items: [],
          summary: [
            { conciliados: 2, quantidade: 3, status: "PAGO", valor: 300 },
            { conciliados: 0, quantidade: 2, status: "CANCELADO", valor: 200 },
          ],
        };
      },
      async getAutomationsReport() {
        calls.push("automations");
        return {
          evolution: [],
          summary: [
            { quantidade: 4, status: "COMPLETED", tipo: "LEMBRETE_ENVIADO" },
            { quantidade: 2, status: "COMPLETED", tipo: "PAGAMENTO_CONFIRMADO" },
            { quantidade: 1, status: "FAILED", tipo: "ERRO_ENVIO" },
          ],
        };
      },
    },
  });
}

function baseFilters() {
  return { from: "2026-07-01", to: "2026-07-09" };
}
