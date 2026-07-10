const {
  FinancialReportRepository,
} = require("../../application/repositories/financial-report.repository.js");

class MySqlFinancialReportRepository extends FinancialReportRepository {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getFinancialOverview(filters) {
    const where = buildChargeWhere(filters, "c");
    const [totals, cashFlow, categories, dimensions] = await Promise.all([
      this.query(financialTotalsSql(where.sql), where.params),
      this.query(cashFlowSql(where.sql), where.params),
      this.query(categoriesSql(where.sql), where.params),
      this.query(dimensionsSql(where.sql), [...where.params, ...where.params, ...where.params]),
    ]);
    return {
      cashFlow: readRows(cashFlow),
      categories: readRows(categories),
      dimensions: readRows(dimensions),
      totals: readRows(totals)[0] || {},
    };
  }

  async getInstallmentsReport(filters) {
    const where = buildChargeWhere(filters, "c");
    const pagination = [filters.limit, filters.offset];
    const [summary, items, count] = await Promise.all([
      this.query(installmentSummarySql(where.sql), where.params),
      this.query(installmentItemsSql(where.sql), [...where.params, ...pagination]),
      this.query(countSql(where.sql), where.params),
    ]);
    return {
      count: Number(readRows(count)[0]?.total || 0),
      items: readRows(items),
      summary: readRows(summary),
    };
  }

  async getDelinquencyReport(filters) {
    const where = buildChargeWhere(filters, "c", { forceOverdue: true });
    const portfolioWhere = buildChargeWhere(filters, "c");
    const [summary, portfolio, evolution, items, count] = await Promise.all([
      this.query(delinquencySummarySql(where.sql), where.params),
      this.query(portfolioTotalSql(portfolioWhere.sql), portfolioWhere.params),
      this.query(delinquencyEvolutionSql(where.sql), where.params),
      this.query(delinquencyItemsSql(where.sql), [...where.params, filters.limit, filters.offset]),
      this.query(delinquencyCountSql(where.sql), where.params),
    ]);
    return {
      count: Number(readRows(count)[0]?.total || 0),
      evolution: readRows(evolution),
      items: readRows(items),
      portfolioValue: Number(readRows(portfolio)[0]?.valor || 0),
      summary: readRows(summary)[0] || {},
    };
  }

  async getPixReport(filters) {
    const where = buildPixWhere(filters);
    const [summary, items, count] = await Promise.all([
      this.query(pixSummarySql(where.sql), where.params),
      this.query(pixItemsSql(where.sql), [...where.params, filters.limit, filters.offset]),
      this.query(pixCountSql(where.sql), where.params),
    ]);
    return {
      count: Number(readRows(count)[0]?.total || 0),
      items: readRows(items),
      summary: readRows(summary),
    };
  }

  async getAutomationsReport(filters) {
    const where = buildAutomationWhere(filters);
    const [summary, evolution] = await Promise.all([
      this.query(automationSummarySql(where.sql), where.params),
      this.query(automationEvolutionSql(where.sql), where.params),
    ]);
    return { evolution: readRows(evolution), summary: readRows(summary) };
  }
}

function buildChargeWhere(filters, alias, options = {}) {
  const dateExpression = `COALESCE(${alias}.data_pagamento, ${alias}.pago_em, ${alias}.vencimento)`;
  const clauses = [`${dateExpression} BETWEEN ? AND ?`, `${alias}.ativo = 1`];
  const params = [filters.from, filters.to];
  addDimensionFilters(clauses, params, filters, alias);
  if (options.forceOverdue) clauses.push(`LOWER(${alias}.status) IN ('atrasado', 'vencido')`);
  else if (filters.status)
    add(clauses, params, `LOWER(${alias}.status) = LOWER(?)`, filters.status);
  return { params, sql: clauses.join(" AND ") };
}

function buildPixWhere(filters) {
  const clauses = ["COALESCE(fp.paid_at, fp.created_at) BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)"];
  const params = [filters.from, filters.to];
  addDimensionFilters(clauses, params, filters, "c");
  if (filters.status) add(clauses, params, "LOWER(fp.status) = LOWER(?)", filters.status);
  return { params, sql: clauses.join(" AND ") };
}

function buildAutomationWhere(filters) {
  const clauses = ["DATE(COALESCE(e.occurred_at, e.created_at)) BETWEEN ? AND ?"];
  const params = [filters.from, filters.to];
  addDimensionFilters(clauses, params, filters, "c");
  if (filters.status) add(clauses, params, "LOWER(e.status) = LOWER(?)", filters.status);
  return { params, sql: clauses.join(" AND ") };
}

function addDimensionFilters(clauses, params, filters, alias) {
  if (filters.unit) add(clauses, params, `${alias}.unidade = ?`, filters.unit);
  if (filters.modality) add(clauses, params, `${alias}.modalidade = ?`, filters.modality);
  if (filters.turma) add(clauses, params, `${alias}.turma = ?`, filters.turma);
  if (filters.category) add(clauses, params, `${alias}.tipo = ?`, filters.category);
  if (filters.professor) {
    add(
      clauses,
      params,
      "(t.professor_nome = ? OR CAST(t.professor_id AS CHAR) = ?)",
      filters.professor,
      filters.professor,
    );
  }
}

function add(clauses, params, sql, ...values) {
  clauses.push(sql);
  params.push(...values);
}

const chargeJoin = `FROM j12_financeiro_cobrancas c LEFT JOIN j12_turmas t ON t.nome = c.turma`;
const pixJoin = `FROM financial_payments fp LEFT JOIN j12_financeiro_cobrancas c ON CAST(c.id AS CHAR) = CAST(fp.charge_id AS CHAR) LEFT JOIN j12_turmas t ON t.nome = c.turma`;
const automationJoin = `FROM financial_automation_events e LEFT JOIN j12_mensalidades m ON e.target_type = 'MENSALIDADE' AND CAST(m.id AS CHAR) = CAST(e.target_id AS CHAR) LEFT JOIN financial_payments fp ON e.target_type = 'PAGAMENTO' AND CAST(fp.id AS CHAR) = CAST(e.target_id AS CHAR) LEFT JOIN j12_financeiro_cobrancas c ON CAST(c.id AS CHAR) = CAST(COALESCE(m.cobranca_id, fp.charge_id, CASE WHEN e.target_type = 'COBRANCA' THEN e.target_id END) AS CHAR) LEFT JOIN j12_turmas t ON t.nome = c.turma`;

function financialTotalsSql(where) {
  return `SELECT COALESCE(SUM(CASE WHEN LOWER(c.status) = 'pago' AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) receitas, COALESCE(SUM(CASE WHEN LOWER(c.status) = 'pago' AND LOWER(c.tipo) IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) despesas FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where}`;
}
function cashFlowSql(where) {
  return `SELECT DATE_FORMAT(COALESCE(c.data_pagamento,c.pago_em,c.vencimento),'%Y-%m') periodo, SUM(CASE WHEN LOWER(c.tipo) IN ('despesa','expense') THEN 0 ELSE COALESCE(c.valor_final,c.valor,0) END) receitas, SUM(CASE WHEN LOWER(c.tipo) IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END) despesas FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status)='pago' GROUP BY periodo ORDER BY periodo`;
}
function categoriesSql(where) {
  return `SELECT COALESCE(NULLIF(c.tipo,''),'sem_categoria') categoria, CASE WHEN LOWER(c.tipo) IN ('despesa','expense') THEN 'despesa' ELSE 'receita' END natureza, COUNT(*) quantidade, SUM(COALESCE(c.valor_final,c.valor,0)) valor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status)='pago' GROUP BY categoria,natureza ORDER BY valor DESC`;
}
function dimensionsSql(where) {
  return `SELECT 'professor' dimensao, COALESCE(NULLIF(t.professor_nome,''),'nao_informado') nome, SUM(COALESCE(c.valor_final,c.valor,0)) receita FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status)='pago' AND LOWER(c.tipo) NOT IN ('despesa','expense') GROUP BY nome UNION ALL SELECT 'turma',COALESCE(NULLIF(c.turma,''),'nao_informado'),SUM(COALESCE(c.valor_final,c.valor,0)) FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status)='pago' AND LOWER(c.tipo) NOT IN ('despesa','expense') GROUP BY c.turma UNION ALL SELECT 'modalidade',COALESCE(NULLIF(c.modalidade,''),'nao_informado'),SUM(COALESCE(c.valor_final,c.valor,0)) FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status)='pago' AND LOWER(c.tipo) NOT IN ('despesa','expense') GROUP BY c.modalidade`;
}
function installmentSummarySql(where) {
  return `SELECT LOWER(c.status) status,COUNT(*) quantidade,SUM(COALESCE(c.valor_final,c.valor,0)) valor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} GROUP BY LOWER(c.status)`;
}
function installmentItemsSql(where) {
  return `SELECT c.id,c.aluno_id,c.nome_aluno,c.status,c.valor,c.valor_final,c.vencimento,c.data_pagamento,c.unidade,c.modalidade,c.turma,c.tipo categoria,t.professor_nome professor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} ORDER BY c.vencimento DESC,c.id LIMIT ? OFFSET ?`;
}
function countSql(where) {
  return `SELECT COUNT(*) total FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where}`;
}
function delinquencySummarySql(where) {
  return `SELECT COUNT(DISTINCT c.aluno_id) alunos_inadimplentes,COUNT(*) mensalidades,SUM(COALESCE(c.valor_final,c.valor,0)) valor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where}`;
}
function portfolioTotalSql(where) {
  return `SELECT SUM(COALESCE(c.valor_final,c.valor,0)) valor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} AND LOWER(c.status) <> 'cancelado'`;
}
function delinquencyEvolutionSql(where) {
  return `SELECT DATE_FORMAT(c.vencimento,'%Y-%m') periodo,COUNT(DISTINCT c.aluno_id) alunos,SUM(COALESCE(c.valor_final,c.valor,0)) valor FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} GROUP BY periodo ORDER BY periodo`;
}
function delinquencyItemsSql(where) {
  return `SELECT c.aluno_id,c.nome_aluno,COUNT(*) mensalidades,SUM(COALESCE(c.valor_final,c.valor,0)) valor,MIN(c.vencimento) vencimento_mais_antigo FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where} GROUP BY c.aluno_id,c.nome_aluno ORDER BY valor DESC LIMIT ? OFFSET ?`;
}
function delinquencyCountSql(where) {
  return `SELECT COUNT(DISTINCT c.aluno_id) total FROM ${chargeJoin.replace(/^FROM /, "")} WHERE ${where}`;
}
function pixSummarySql(where) {
  return `SELECT UPPER(fp.status) status,COUNT(*) quantidade,SUM(fp.amount) valor,SUM(CASE WHEN UPPER(fp.status)='PAGO' AND (fp.e2eid IS NOT NULL OR fp.inter_transaction_id IS NOT NULL) THEN 1 ELSE 0 END) conciliados ${pixJoin} WHERE ${where} GROUP BY UPPER(fp.status)`;
}
function pixItemsSql(where) {
  return `SELECT fp.id,fp.txid,fp.amount valor,fp.status,fp.due_date vencimento,fp.paid_at pago_em,CASE WHEN fp.e2eid IS NOT NULL OR fp.inter_transaction_id IS NOT NULL THEN 1 ELSE 0 END conciliado ${pixJoin} WHERE ${where} ORDER BY fp.created_at DESC LIMIT ? OFFSET ?`;
}
function pixCountSql(where) {
  return `SELECT COUNT(*) total ${pixJoin} WHERE ${where}`;
}
function automationSummarySql(where) {
  return `SELECT e.event_type tipo,e.status,COUNT(*) quantidade ${automationJoin} WHERE ${where} GROUP BY e.event_type,e.status ORDER BY e.event_type,e.status`;
}
function automationEvolutionSql(where) {
  return `SELECT DATE_FORMAT(COALESCE(e.occurred_at,e.created_at),'%Y-%m-%d') periodo,e.status,COUNT(*) quantidade ${automationJoin} WHERE ${where} GROUP BY periodo,e.status ORDER BY periodo`;
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function getDefaultQueryRunner() {
  return require("../../../../../config/db.js").query;
}

module.exports = {
  MySqlFinancialReportRepository,
  buildAutomationWhere,
  buildChargeWhere,
  buildPixWhere,
};
