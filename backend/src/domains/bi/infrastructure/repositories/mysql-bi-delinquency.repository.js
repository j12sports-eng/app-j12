const { BiReadRepositoryContract } = require("../../application/index.js");

const SCOPE = `c.ativo=1 AND LOWER(c.tipo) NOT IN ('despesa','expense')
  AND LOWER(c.status) NOT IN ('cancelado','cancelada','anulado','anulada')
  AND (? IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE CAST(u.id AS CHAR)=? AND (u.nome=c.unidade OR CAST(u.id AS CHAR)=c.unidade)))`;
const OVERDUE = `c.vencimento < DATE_ADD(?,INTERVAL 1 DAY)
  AND (COALESCE(c.data_pagamento,c.pago_em) IS NULL OR COALESCE(c.data_pagamento,c.pago_em) > ?)`;
const DELINQUENCY_KPIS_SQL = `SELECT
  COALESCE(SUM(CASE WHEN ${OVERDUE} THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) overdue_value,
  COUNT(DISTINCT CASE WHEN ${OVERDUE} THEN c.id END) overdue_obligations,
  COUNT(DISTINCT CASE WHEN ${OVERDUE} THEN c.aluno_id END) unique_debtors,
  COALESCE(SUM(CASE WHEN c.vencimento<=? AND LOWER(c.status) NOT IN ('cancelado','cancelada','anulado','anulada') THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) eligible_value,
  COALESCE(SUM(CASE WHEN LOWER(c.status)='pago' AND COALESCE(c.data_pagamento,c.pago_em)>c.vencimento AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? THEN COALESCE(c.valor_final,c.valor,0) ELSE 0 END),0) recovered_value,
  COUNT(DISTINCT CASE WHEN LOWER(c.status)='pago' AND COALESCE(c.data_pagamento,c.pago_em)>c.vencimento AND COALESCE(c.data_pagamento,c.pago_em) BETWEEN ? AND ? THEN c.id END) recovered_obligations
  FROM j12_financeiro_cobrancas c WHERE ${SCOPE}`;
const DELINQUENCY_AGING_SQL = `SELECT CASE
  WHEN DATEDIFF(?,c.vencimento) BETWEEN 1 AND 7 THEN '1-7'
  WHEN DATEDIFF(?,c.vencimento) BETWEEN 8 AND 15 THEN '8-15'
  WHEN DATEDIFF(?,c.vencimento) BETWEEN 16 AND 30 THEN '16-30'
  WHEN DATEDIFF(?,c.vencimento) BETWEEN 31 AND 60 THEN '31-60'
  WHEN DATEDIFF(?,c.vencimento) BETWEEN 61 AND 90 THEN '61-90' ELSE '90+' END bucket,
  COUNT(DISTINCT c.id) quantity,SUM(COALESCE(c.valor_final,c.valor,0)) value
  FROM j12_financeiro_cobrancas c WHERE ${SCOPE} AND ${OVERDUE}
  GROUP BY bucket ORDER BY FIELD(bucket,'1-7','8-15','16-30','31-60','61-90','90+')`;
const DELINQUENCY_EVOLUTION_SQL = `SELECT DATE_FORMAT(c.vencimento,'%Y-%m') period,
  COUNT(DISTINCT c.id) quantity,SUM(COALESCE(c.valor_final,c.valor,0)) value
  FROM j12_financeiro_cobrancas c WHERE ${SCOPE} AND ${OVERDUE}
  GROUP BY period ORDER BY period`;
const DELINQUENCY_STATUS_SQL = `SELECT LOWER(c.status) status,COUNT(DISTINCT c.id) quantity,
  SUM(COALESCE(c.valor_final,c.valor,0)) value FROM j12_financeiro_cobrancas c
  WHERE c.ativo=1 AND LOWER(c.tipo) NOT IN ('despesa','expense')
  AND c.vencimento BETWEEN ? AND ?
  AND (? IS NULL OR EXISTS (SELECT 1 FROM j12_unidades u WHERE CAST(u.id AS CHAR)=? AND (u.nome=c.unidade OR CAST(u.id AS CHAR)=c.unidade)))
  GROUP BY LOWER(c.status) ORDER BY value DESC`;

class MySqlBiDelinquencyRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }
  async getDelinquencyAnalytics({ current }) {
    const [kpis, aging, evolution, statuses] = await Promise.all([
      this.query(DELINQUENCY_KPIS_SQL, kpiParams(current)),
      this.query(DELINQUENCY_AGING_SQL, agingParams(current)),
      this.query(DELINQUENCY_EVOLUTION_SQL, evolutionParams(current)),
      this.query(DELINQUENCY_STATUS_SQL, statusParams(current)),
    ]);
    return {
      aging: rows(aging),
      evolution: rows(evolution),
      kpis: rows(kpis)[0] || {},
      statuses: rows(statuses),
    };
  }
}
function scopeParams(p) {
  return [p.unitId, p.unitId];
}
function kpiParams(p) {
  return [
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    p.startDate,
    p.endDate,
    p.startDate,
    p.endDate,
    ...scopeParams(p),
  ];
}
function agingParams(p) {
  return [
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    p.endDate,
    ...scopeParams(p),
    p.endDate,
    p.endDate,
  ];
}
function evolutionParams(p) {
  return [...scopeParams(p), p.endDate, p.endDate];
}
function statusParams(p) {
  return [p.startDate, p.endDate, ...scopeParams(p)];
}
function rows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}
module.exports = {
  DELINQUENCY_AGING_SQL,
  DELINQUENCY_EVOLUTION_SQL,
  DELINQUENCY_KPIS_SQL,
  DELINQUENCY_STATUS_SQL,
  MySqlBiDelinquencyRepository,
  agingParams,
  evolutionParams,
  kpiParams,
  statusParams,
};
