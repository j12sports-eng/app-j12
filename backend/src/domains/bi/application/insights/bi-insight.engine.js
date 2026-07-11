const DEFAULT_THRESHOLDS = Object.freeze({
  criticalDelinquencyRate: 20,
  criticalRevenueDeclinePercent: -25,
  criticalClassOccupancyRate: 95,
  lowCourtOccupancyRate: 30,
  underutilizedClassOccupancyRate: 50,
  warningDelinquencyRate: 10,
  warningRevenueDeclinePercent: -10,
});

class BiInsightEngine {
  constructor(options = {}) {
    this.thresholds = Object.freeze({ ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) });
  }

  generate({ classes, courts, delinquency, financial, generatedAt, students }) {
    const insights = [
      ...this.financial(financial, generatedAt),
      ...this.delinquency(delinquency, generatedAt),
      ...this.classes(classes, generatedAt),
      ...this.students(students, generatedAt),
      ...this.courts(courts, generatedAt),
    ];
    return Object.freeze(insights.sort(comparePriority).map(Object.freeze));
  }

  financial(data, timestamp) {
    const comparison = data?.insights?.currentVsPrevious;
    if (
      !comparison?.available ||
      comparison.percent >= this.thresholds.warningRevenueDeclinePercent
    )
      return [];
    const critical = comparison.percent <= this.thresholds.criticalRevenueDeclinePercent;
    return [
      this.insight({
        action:
          "Revisar as composicoes de receita e confirmar cobrancas pendentes antes de decidir uma intervencao.",
        current: comparison.currentValue,
        description: `A receita recebida variou ${comparison.percent}% contra o periodo anterior. O dado indica variacao, nao sua causa.`,
        id: "financial-revenue-decline",
        period: data.filters?.current,
        previous: comparison.previousValue,
        severity: critical ? "critical" : "warning",
        source: "BiFinancialService",
        timestamp,
        title: critical ? "Queda acentuada da receita recebida" : "Receita recebida em queda",
        type: "financial",
        variation: comparison.percent,
      }),
    ];
  }

  delinquency(data, timestamp) {
    const metric = data?.kpis?.delinquencyRate;
    if (!metric?.available || metric.value < this.thresholds.warningDelinquencyRate) return [];
    const critical = metric.value >= this.thresholds.criticalDelinquencyRate;
    return [
      this.insight({
        action:
          "Priorizar a analise das faixas de atraso e dos fluxos de recuperacao, sem presumir a causa.",
        current: metric.value,
        description: `A inadimplencia esta em ${metric.value}%. O alerta usa o limite configurado de ${critical ? this.thresholds.criticalDelinquencyRate : this.thresholds.warningDelinquencyRate}%.`,
        id: "delinquency-rate-threshold",
        period: data.filters?.current,
        previous: null,
        severity: critical ? "critical" : "warning",
        source: "BiDelinquencyService",
        timestamp,
        title: critical ? "Inadimplencia em nivel critico" : "Inadimplencia acima do limite",
        type: "delinquency",
        variation: null,
      }),
    ];
  }

  classes(data, timestamp) {
    return (data?.table || [])
      .filter((row) => row.active && row.capacityValid)
      .flatMap((row) => {
        if (row.occupancyRate >= this.thresholds.criticalClassOccupancyRate)
          return [
            this.insight({
              action: "Avaliar capacidade, fila de espera ou abertura de nova turma.",
              current: row.occupancyRate,
              description: `${row.className} atingiu ${row.occupancyRate}% de ocupacao.`,
              id: `class-critical-${safeId(row.classId)}`,
              period: data.filters?.current,
              previous: null,
              severity: "critical",
              source: "BiClassesService",
              timestamp,
              title: "Turma com ocupacao critica",
              type: "class_capacity",
              variation: null,
            }),
          ];
        if (row.occupancyRate < this.thresholds.underutilizedClassOccupancyRate)
          return [
            this.insight({
              action: "Revisar horario, modalidade e demanda antes de alterar a oferta.",
              current: row.occupancyRate,
              description: `${row.className} registra ${row.occupancyRate}% de ocupacao.`,
              id: `class-underused-${safeId(row.classId)}`,
              period: data.filters?.current,
              previous: null,
              severity: "info",
              source: "BiClassesService",
              timestamp,
              title: "Turma subutilizada",
              type: "class_capacity",
              variation: null,
            }),
          ];
        return [];
      });
  }

  students(data, timestamp) {
    const comparison = data?.kpis?.newStudents?.comparison;
    if (!comparison?.available || comparison.percent >= 0) return [];
    return [
      this.insight({
        action: "Comparar canais e unidades do periodo antes de atribuir uma causa.",
        current: data.kpis.newStudents.value,
        description: `Novos alunos variaram ${comparison.percent}% contra o periodo anterior.`,
        id: "students-growth-slowdown",
        period: data.filters?.current,
        previous: comparison.previousValue,
        severity: "warning",
        source: "BiStudentsService",
        timestamp,
        title: "Entrada de novos alunos desacelerou",
        type: "students",
        variation: comparison.percent,
      }),
    ];
  }

  courts(data, timestamp) {
    const metric = data?.kpis?.occupancyRate;
    if (!metric?.available || metric.value >= this.thresholds.lowCourtOccupancyRate) return [];
    return [
      this.insight({
        action: "Analisar horarios e quadras com menor uso antes de ajustar disponibilidade.",
        current: metric.value,
        description: `A ocupacao consolidada das quadras esta em ${metric.value}%.`,
        id: "courts-low-occupancy",
        period: data.filters?.current,
        previous: null,
        severity: "info",
        source: "BiCourtsService",
        timestamp,
        title: "Baixa ocupacao das quadras",
        type: "courts",
        variation: null,
      }),
    ];
  }

  insight(value) {
    return {
      action: value.action,
      currentMetric: value.current,
      dataSource: value.source,
      description: value.description,
      id: value.id,
      period: value.period || null,
      previousReference: value.previous,
      severity: value.severity,
      timestamp: value.timestamp,
      title: value.title,
      type: value.type,
      variation: value.variation,
    };
  }
}

const PRIORITY = { critical: 0, warning: 1, success: 2, info: 3 };
function comparePriority(left, right) {
  return PRIORITY[left.severity] - PRIORITY[right.severity] || left.id.localeCompare(right.id);
}
function safeId(value) {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
}

module.exports = { BiInsightEngine, DEFAULT_THRESHOLDS };
