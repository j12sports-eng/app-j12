const { BiReadRepositoryContract } = require("../../application/index.js");
const {
  InterPaymentStatus,
} = require("../../../financeiro/inter/entities/inter-payment.entity.js");

const FINANCIAL_KPIS_SQL = `
  SELECT
    COALESCE(SUM(CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) received_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) <> ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) expected_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = 'pendente' AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) pending_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = 'atrasado' AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) overdue_revenue,
    COALESCE(SUM(CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) expenses,
    COUNT(DISTINCT CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN c.aluno_id END) paying_students,
    COALESCE(SUM(CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) previous_received_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) <> ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) previous_expected_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = 'pendente' AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) previous_pending_revenue,
    COALESCE(SUM(CASE WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = 'atrasado' AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) previous_overdue_revenue,
    COALESCE(SUM(CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) IN ('despesa','expense') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) previous_expenses,
    COUNT(DISTINCT CASE WHEN LOWER(c.status) = ? AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ? AND LOWER(c.tipo) NOT IN ('despesa','expense') THEN c.aluno_id END) previous_paying_students
  FROM j12_financeiro_cobrancas c
  WHERE c.ativo = 1 AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci))))
`;

const FINANCIAL_EVOLUTION_SQL = `
  SELECT DATE_FORMAT(COALESCE(c.data_pagamento,c.pago_em),'%Y-%m') period,
    COALESCE(SUM(COALESCE(c.valor_final,c.valor,0)),0) received_revenue
  FROM j12_financeiro_cobrancas c
  WHERE c.ativo = 1 AND LOWER(c.status) = ? AND LOWER(c.tipo) NOT IN ('despesa','expense')
    AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ?
    AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci) = (CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci))))
  GROUP BY period ORDER BY period
`;

const FINANCIAL_BREAKDOWNS_SQL = `
  SELECT 'category' dimension, COALESCE(NULLIF(c.tipo,''),'nao_informado') dimension_key, COUNT(*) quantity, SUM(COALESCE(c.valor_final,c.valor,0)) value
  FROM j12_financeiro_cobrancas c WHERE c.ativo=1 AND LOWER(c.status)=? AND LOWER(c.tipo) NOT IN ('despesa','expense') AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci)))) GROUP BY COALESCE(NULLIF(c.tipo,''),'nao_informado')
  UNION ALL
  SELECT 'modality',COALESCE(NULLIF(c.modalidade,''),'nao_informado'),COUNT(*),SUM(COALESCE(c.valor_final,c.valor,0)) FROM j12_financeiro_cobrancas c WHERE c.ativo=1 AND LOWER(c.status)=? AND LOWER(c.tipo) NOT IN ('despesa','expense') AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci)))) GROUP BY c.modalidade
  UNION ALL
  SELECT 'unit',COALESCE(NULLIF(c.unidade,''),'nao_informado'),COUNT(*),SUM(COALESCE(c.valor_final,c.valor,0)) FROM j12_financeiro_cobrancas c WHERE c.ativo=1 AND LOWER(c.status)=? AND LOWER(c.tipo) NOT IN ('despesa','expense') AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci)))) GROUP BY c.unidade
  UNION ALL
  SELECT 'paymentMethod',COALESCE(NULLIF(LOWER(c.forma_pagamento),''),'nao_informado'),COUNT(*),SUM(COALESCE(c.valor_final,c.valor,0)) FROM j12_financeiro_cobrancas c WHERE c.ativo=1 AND LOWER(c.status)=? AND LOWER(c.tipo) NOT IN ('despesa','expense') AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? AND (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) AND ((CONVERT(u.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR (CONVERT(CAST(u.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci)=(CONVERT(c.unidade USING utf8mb4) COLLATE utf8mb4_unicode_ci)))) GROUP BY LOWER(c.forma_pagamento), COALESCE(NULLIF(LOWER(c.forma_pagamento),''),'nao_informado')
  ORDER BY dimension,value DESC
`;

class MySqlBiFinancialRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getFinancialAnalytics({ current, previous }) {
    const [kpiResult, evolutionResult, breakdownResult] = await Promise.all([
      this.query(FINANCIAL_KPIS_SQL, kpiParams(current, previous)),
      this.query(FINANCIAL_EVOLUTION_SQL, evolutionParams(current)),
      this.query(FINANCIAL_BREAKDOWNS_SQL, breakdownParams(current)),
    ]);
    const kpis = readRows(kpiResult)[0] || {};
    const breakdowns = readRows(breakdownResult);
    return {
      categories: dimension(breakdowns, "category", "category"),
      current: mapKpis(kpis, ""),
      evolution: readRows(evolutionResult).map((row) => ({
        period: row.period,
        receivedRevenue: numeric(row.received_revenue),
      })),
      modalities: dimension(breakdowns, "modality", "modality"),
      paymentMethods: dimension(breakdowns, "paymentMethod", "paymentMethod"),
      previous: mapKpis(kpis, "previous_"),
      units: dimension(breakdowns, "unit", "unit"),
    };
  }
}

function kpiParams(current, previous) {
  const paid = InterPaymentStatus.PAID.toLowerCase();
  const cancelled = InterPaymentStatus.CANCELLED.toLowerCase();
  return [
    paid,
    current.startDate,
    current.endDate,
    current.startDate,
    current.endDate,
    cancelled,
    current.startDate,
    current.endDate,
    current.startDate,
    current.endDate,
    paid,
    current.startDate,
    current.endDate,
    paid,
    current.startDate,
    current.endDate,
    paid,
    previous.startDate,
    previous.endDate,
    previous.startDate,
    previous.endDate,
    cancelled,
    previous.startDate,
    previous.endDate,
    previous.startDate,
    previous.endDate,
    paid,
    previous.startDate,
    previous.endDate,
    paid,
    previous.startDate,
    previous.endDate,
    current.unitId,
    current.unitId,
  ];
}
function evolutionParams(period) {
  return [
    InterPaymentStatus.PAID.toLowerCase(),
    period.startDate,
    period.endDate,
    period.unitId,
    period.unitId,
  ];
}
function breakdownParams(period) {
  return Array.from({ length: 4 }, () => evolutionParams(period)).flat();
}
function mapKpis(row, prefix) {
  return {
    expenses: numeric(row[`${prefix}expenses`]),
    expectedRevenue: numeric(row[`${prefix}expected_revenue`]),
    overdueRevenue: numeric(row[`${prefix}overdue_revenue`]),
    payingStudents: numeric(row[`${prefix}paying_students`]),
    pendingRevenue: numeric(row[`${prefix}pending_revenue`]),
    receivedRevenue: numeric(row[`${prefix}received_revenue`]),
  };
}
function dimension(rows, type, key) {
  return rows
    .filter((row) => row.dimension === type)
    .map((row) => ({
      [key]: row.dimension_key,
      quantity: numeric(row.quantity),
      value: numeric(row.value),
    }));
}
function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  FINANCIAL_BREAKDOWNS_SQL,
  FINANCIAL_EVOLUTION_SQL,
  FINANCIAL_KPIS_SQL,
  MySqlBiFinancialRepository,
  breakdownParams,
  evolutionParams,
  kpiParams,
};
