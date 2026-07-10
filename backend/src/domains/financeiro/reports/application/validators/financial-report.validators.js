const FINANCIAL_REPORT_FILTER_INVALID = "FINANCIAL_REPORT_FILTER_INVALID";
const FINANCIAL_REPORT_TYPE_INVALID = "FINANCIAL_REPORT_TYPE_INVALID";

const FinancialReportType = Object.freeze({
  ALL: "all",
  AUTOMATIONS: "automacoes",
  DELINQUENCY: "inadimplencia",
  FINANCIAL: "financeiro",
  INSTALLMENTS: "mensalidades",
  PIX: "pix",
});

function validateFinancialReportFilters(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const defaultTo = dateOnly(now);
  const defaultFromDate = new Date(`${defaultTo}T00:00:00.000Z`);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);

  const rawFrom = input.from ?? input.dateFrom ?? input.inicio;
  const rawTo = input.to ?? input.dateTo ?? input.fim;
  const parsedFrom = normalizeDate(rawFrom);
  const parsedTo = normalizeDate(rawTo);
  if ((rawFrom !== undefined && !parsedFrom) || (rawTo !== undefined && !parsedTo)) {
    throw controlledError(
      "Periodo do relatorio financeiro invalido.",
      FINANCIAL_REPORT_FILTER_INVALID,
      {
        fields: ["from", "to"],
      },
    );
  }
  const from = parsedFrom || dateOnly(defaultFromDate);
  const to = parsedTo || defaultTo;
  if (!from || !to || from > to) {
    throw controlledError(
      "Periodo do relatorio financeiro invalido.",
      FINANCIAL_REPORT_FILTER_INVALID,
      {
        fields: ["from", "to"],
      },
    );
  }

  return Object.freeze({
    category: nullableText(input.category ?? input.categoria, 100),
    from,
    limit: normalizeLimit(input.limit, 100, 500),
    modality: nullableText(input.modality ?? input.modalidade, 191),
    offset: (normalizePage(input.page) - 1) * normalizeLimit(input.limit, 100, 500),
    page: normalizePage(input.page),
    professor: nullableText(input.professor, 191),
    status: nullableText(input.status, 50),
    to,
    turma: nullableText(input.turma, 191),
    unit: nullableText(input.unit ?? input.unidade, 191),
  });
}

function validateFinancialReportType(value, options = {}) {
  const allowAll = options.allowAll !== false;
  const normalized = nullableText(value, 50)?.toLowerCase() || FinancialReportType.ALL;
  const supported = Object.values(FinancialReportType).filter(
    (type) => allowAll || type !== FinancialReportType.ALL,
  );
  if (!supported.includes(normalized)) {
    throw controlledError("Tipo de relatorio financeiro invalido.", FINANCIAL_REPORT_TYPE_INVALID, {
      supported,
    });
  }
  return normalized;
}

function controlledError(message, code, details = {}) {
  const error = new TypeError(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeDate(value) {
  const normalized = nullableText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized || "") &&
    !Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))
    ? normalized
    : null;
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function normalizeLimit(value, fallback, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function nullableText(value, max) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}

module.exports = {
  FINANCIAL_REPORT_FILTER_INVALID,
  FINANCIAL_REPORT_TYPE_INVALID,
  FinancialReportType,
  validateFinancialReportFilters,
  validateFinancialReportType,
};
