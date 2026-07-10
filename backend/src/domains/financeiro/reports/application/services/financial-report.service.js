const { toFinancialReportDto } = require("../dtos/financial-report.dto.js");
const {
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  exportFinancialReportXlsx,
} = require("../exporters/financial-report.exporters.js");
const {
  FinancialReportType,
  validateFinancialReportFilters,
  validateFinancialReportType,
} = require("../validators/financial-report.validators.js");

class FinancialReportService {
  constructor(options = {}) {
    this.repository = options.repository || options.financialReportRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async getConsolidated(input = {}) {
    const filters = this.filters(input);
    const [financial, installments, delinquency, pix, automations] = await Promise.all([
      this.getRepository().getFinancialOverview(filters),
      this.getRepository().getInstallmentsReport(filters),
      this.getRepository().getDelinquencyReport(filters),
      this.getRepository().getPixReport(filters),
      this.getRepository().getAutomationsReport(filters),
    ]);
    return this.dto(FinancialReportType.ALL, filters, {
      automacoes: mapAutomations(automations),
      financeiro: mapFinancial(financial),
      inadimplencia: mapDelinquency(delinquency),
      mensalidades: mapInstallments(installments, filters),
      pix: mapPix(pix, filters),
    });
  }

  async getFinancial(input = {}) {
    const filters = this.filters(input);
    return this.dto(
      FinancialReportType.FINANCIAL,
      filters,
      mapFinancial(await this.getRepository().getFinancialOverview(filters)),
    );
  }

  async getInstallments(input = {}) {
    const filters = this.filters(input);
    return this.dto(
      FinancialReportType.INSTALLMENTS,
      filters,
      mapInstallments(await this.getRepository().getInstallmentsReport(filters), filters),
    );
  }

  async getDelinquency(input = {}) {
    const filters = this.filters(input);
    return this.dto(
      FinancialReportType.DELINQUENCY,
      filters,
      mapDelinquency(await this.getRepository().getDelinquencyReport(filters)),
    );
  }

  async getPix(input = {}) {
    const filters = this.filters(input);
    return this.dto(
      FinancialReportType.PIX,
      filters,
      mapPix(await this.getRepository().getPixReport(filters), filters),
    );
  }

  async getAutomations(input = {}) {
    const filters = this.filters(input);
    return this.dto(
      FinancialReportType.AUTOMATIONS,
      filters,
      mapAutomations(await this.getRepository().getAutomationsReport(filters)),
    );
  }

  async export(input = {}, format) {
    const reportType = validateFinancialReportType(input.report ?? input.tipo);
    const report = await this.getByType(reportType, input);
    const exporters = {
      csv: {
        contentType: "text/csv; charset=utf-8",
        extension: "csv",
        run: exportFinancialReportCsv,
      },
      pdf: { contentType: "application/pdf", extension: "pdf", run: exportFinancialReportPdf },
      xlsx: {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        run: exportFinancialReportXlsx,
      },
    };
    const exporter = exporters[String(format || "").toLowerCase()];
    if (!exporter)
      throw Object.assign(new TypeError("Formato de exportacao financeira invalido."), {
        code: "FINANCIAL_REPORT_EXPORT_FORMAT_INVALID",
      });
    return {
      buffer: exporter.run(report),
      contentType: exporter.contentType,
      filename: `j12-relatorio-${reportType}-${this.now().toISOString().slice(0, 10)}.${exporter.extension}`,
    };
  }

  async getByType(type, input) {
    const methods = {
      [FinancialReportType.ALL]: "getConsolidated",
      [FinancialReportType.AUTOMATIONS]: "getAutomations",
      [FinancialReportType.DELINQUENCY]: "getDelinquency",
      [FinancialReportType.FINANCIAL]: "getFinancial",
      [FinancialReportType.INSTALLMENTS]: "getInstallments",
      [FinancialReportType.PIX]: "getPix",
    };
    return this[methods[type]](input);
  }

  filters(input) {
    return validateFinancialReportFilters(input, { now: this.now() });
  }
  dto(report, filters, data) {
    return toFinancialReportDto({ data, filters, generatedAt: this.now().toISOString(), report });
  }
  getRepository() {
    const required = [
      "getFinancialOverview",
      "getInstallmentsReport",
      "getDelinquencyReport",
      "getPixReport",
      "getAutomationsReport",
    ];
    if (
      !this.repository ||
      required.some((method) => typeof this.repository[method] !== "function")
    ) {
      throw Object.assign(
        new TypeError("FinancialReportService requires FinancialReportRepository."),
        { code: "FINANCIAL_REPORT_REPOSITORY_INVALID" },
      );
    }
    return this.repository;
  }
}

function mapFinancial(data = {}) {
  const receitas = money(data.totals?.receitas);
  const despesas = money(data.totals?.despesas);
  return {
    categorias: data.categories || [],
    despesas,
    fluxoCaixa: (data.cashFlow || []).map((row) => ({
      ...row,
      despesas: money(row.despesas),
      receitas: money(row.receitas),
      saldo: money(row.receitas) - money(row.despesas),
    })),
    modalidades: dimensions(data.dimensions, "modalidade"),
    professores: dimensions(data.dimensions, "professor"),
    receitas,
    saldo: money(receitas - despesas),
    turmas: dimensions(data.dimensions, "turma"),
  };
}

function mapInstallments(data = {}, filters = {}) {
  const status = Object.fromEntries(
    (data.summary || []).map((row) => [
      normalizeStatus(row.status),
      { quantidade: Number(row.quantidade || 0), valor: money(row.valor) },
    ]),
  );
  return {
    canceladas: status.cancelado || emptyTotal(),
    items: data.items || [],
    pagas: status.pago || emptyTotal(),
    pagination: pagination(data.count, filters),
    pendentes: status.pendente || emptyTotal(),
    renegociadas: status.renegociado || emptyTotal(),
    vencidas: mergeTotals(status.atrasado, status.vencido),
  };
}

function mapDelinquency(data = {}) {
  const overdue = money(data.summary?.valor);
  const portfolio = money(data.portfolioValue);
  return {
    alunosInadimplentes: Number(data.summary?.alunos_inadimplentes || 0),
    evolucao: data.evolution || [],
    items: data.items || [],
    mensalidades: Number(data.summary?.mensalidades || 0),
    percentual: portfolio > 0 ? money((overdue / portfolio) * 100) : 0,
    valor: overdue,
  };
}

function mapPix(data = {}, filters = {}) {
  const summary = Object.fromEntries(
    (data.summary || []).map((row) => [normalizeStatus(row.status), row]),
  );
  const all = Object.values(summary);
  return {
    cancelados: pixTotal(summary.cancelado),
    conciliacoes: all.reduce((total, row) => total + Number(row.conciliados || 0), 0),
    emitidos: all.reduce((total, row) => total + Number(row.quantidade || 0), 0),
    expirados: pixTotal(summary.vencido || summary.expirado),
    items: data.items || [],
    pagos: pixTotal(summary.pago),
    pagination: pagination(data.count, filters),
  };
}

function mapAutomations(data = {}) {
  const totals = {
    agradecimentosEnviados: 0,
    cobrancasEnviadas: 0,
    falhas: 0,
    lembretesEnviados: 0,
    pagamentosConfirmados: 0,
  };
  for (const row of data.summary || []) {
    const type = String(row.tipo || "").toUpperCase();
    const count = Number(row.quantidade || 0);
    if (String(row.status).toUpperCase() === "FAILED" || type === "ERRO_ENVIO")
      totals.falhas += count;
    if (type === "LEMBRETE_ENVIADO") totals.lembretesEnviados += count;
    if (type === "COBRANCA_ENVIADA" || type === "TENTATIVA_COBRANCA")
      totals.cobrancasEnviadas += count;
    if (type === "PAGAMENTO_CONFIRMADO") totals.pagamentosConfirmados += count;
    if (type === "AGRADECIMENTO_ENVIADO") totals.agradecimentosEnviados += count;
  }
  return { evolucao: data.evolution || [], ...totals };
}

function dimensions(rows, type) {
  return (rows || [])
    .filter((row) => row.dimensao === type)
    .map((row) => ({ nome: row.nome, receita: money(row.receita) }));
}
function pagination(total, filters) {
  return {
    limit: filters.limit,
    page: filters.page,
    total: Number(total || 0),
    totalPages: Math.ceil(Number(total || 0) / filters.limit),
  };
}
function pixTotal(row) {
  return { quantidade: Number(row?.quantidade || 0), valor: money(row?.valor) };
}
function emptyTotal() {
  return { quantidade: 0, valor: 0 };
}
function mergeTotals(...values) {
  return values.filter(Boolean).reduce(
    (result, value) => ({
      quantidade: result.quantidade + Number(value.quantidade || 0),
      valor: money(result.valor + money(value.valor)),
    }),
    emptyTotal(),
  );
}
function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

module.exports = {
  FinancialReportService,
  mapAutomations,
  mapDelinquency,
  mapFinancial,
  mapInstallments,
  mapPix,
};
