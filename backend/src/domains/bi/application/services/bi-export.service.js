const {
  exportFinancialReportCsv,
  exportFinancialReportXlsx,
  reportToRows,
} = require("../../../financeiro/reports/application/exporters/financial-report.exporters.js");
const { jsPDF } = require("jspdf");

const BI_EXPORT_MAX_ROWS = 5000;
const BI_EXPORT_TIMEOUT_MS = 15000;
const REPORT_METHODS = Object.freeze({
  championships: "getAnalytics",
  classes: "getAnalytics",
  courts: "getAnalytics",
  delinquency: "getAnalytics",
  executive: "getDashboard",
  financial: "getAnalytics",
  students: "getAnalytics",
});
const EXPORTERS = Object.freeze({
  csv: Object.freeze({ contentType: "text/csv; charset=utf-8", run: exportFinancialReportCsv }),
  pdf: Object.freeze({ contentType: "application/pdf", run: exportBiReportPdf }),
  xlsx: Object.freeze({
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    run: exportFinancialReportXlsx,
  }),
});

class BiExportService {
  constructor(options = {}) {
    this.services = options.services || {};
    this.now = typeof options.now === "function" ? options.now : () => new Date();
    this.maxRows = positiveInteger(options.maxRows, BI_EXPORT_MAX_ROWS);
    this.timeoutMs = positiveInteger(options.timeoutMs, BI_EXPORT_TIMEOUT_MS);
  }

  async export({ format, query = {}, report }) {
    const reportName = normalizeAllowed(report, REPORT_METHODS, "BI_EXPORT_REPORT_INVALID");
    const formatName = normalizeAllowed(format, EXPORTERS, "BI_EXPORT_FORMAT_INVALID");
    const service = this.services[reportName];
    const method = REPORT_METHODS[reportName];
    if (!service || typeof service[method] !== "function") {
      throw Object.assign(new TypeError("BI export service dependency is invalid."), {
        code: "BI_EXPORT_DEPENDENCY_INVALID",
      });
    }
    const dashboard = await withTimeout(
      Promise.resolve().then(() => service[method](query)),
      this.timeoutMs,
    );
    const reportPayload = Object.freeze({ dashboard, report: reportName });
    const rows = reportToRows(reportPayload);
    if (rows.length > this.maxRows) {
      throw Object.assign(new RangeError("BI export row limit exceeded."), {
        code: "BI_EXPORT_LIMIT_EXCEEDED",
        details: { limit: this.maxRows, rows: rows.length },
      });
    }
    const exporter = EXPORTERS[formatName];
    const date = validDate(this.now()).toISOString().slice(0, 10);
    return Object.freeze({
      buffer: exporter.run(reportPayload),
      contentType: exporter.contentType,
      filename: `j12-bi-${reportName}-${date}.${formatName}`,
      rows: rows.length,
    });
  }
}

function normalizeAllowed(value, allowed, code) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(allowed, normalized)) {
    throw Object.assign(new TypeError("BI export option is invalid."), { code });
  }
  return normalized;
}
function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new TypeError("BI export clock is invalid."), {
      code: "BI_CLOCK_INVALID",
    });
  }
  return date;
}
function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("BI export timed out."), { code: "BI_EXPORT_TIMEOUT" })),
      timeoutMs,
    );
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// O exportador financeiro limita PDFs a 300 linhas. O BI usa a mesma representacao
// tabular, mas pagina todas as linhas para nunca entregar um relatorio truncado.
function exportBiReportPdf(report) {
  const document = new jsPDF({ format: "a4", unit: "pt" });
  const rows = reportToRows(report);
  document.setFontSize(14);
  document.text(`J12 - Relatorio BI ${report.report}`, 40, 45);
  document.setFontSize(8);
  let y = 65;
  for (const row of rows) {
    const line = Object.entries(row)
      .map(([key, value]) => `${key}: ${formatPdfValue(value)}`)
      .join(" | ");
    const wrapped = document.splitTextToSize(line, 515);
    if (y + wrapped.length * 10 > 800) {
      document.addPage();
      y = 40;
    }
    document.text(wrapped, 40, y);
    y += wrapped.length * 10 + 4;
  }
  return Buffer.from(document.output("arraybuffer"));
}

function formatPdfValue(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
module.exports = {
  BI_EXPORT_MAX_ROWS,
  BI_EXPORT_TIMEOUT_MS,
  BiExportService,
  EXPORTERS,
  REPORT_METHODS,
  exportBiReportPdf,
};
