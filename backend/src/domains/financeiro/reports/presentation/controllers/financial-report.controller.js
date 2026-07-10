const CONTROLLED_CODES = new Set([
  "FINANCIAL_REPORT_EXPORT_FORMAT_INVALID",
  "FINANCIAL_REPORT_FILTER_INVALID",
  "FINANCIAL_REPORT_TYPE_INVALID",
]);

class FinancialReportController {
  constructor(options = {}) {
    this.service = options.service || options.financialReportService || null;
    this.getAll = this.getAll.bind(this);
    this.getFinancial = this.getFinancial.bind(this);
    this.getInstallments = this.getInstallments.bind(this);
    this.getDelinquency = this.getDelinquency.bind(this);
    this.getPix = this.getPix.bind(this);
    this.getAutomations = this.getAutomations.bind(this);
    this.exportPdf = this.exportPdf.bind(this);
    this.exportXlsx = this.exportXlsx.bind(this);
    this.exportCsv = this.exportCsv.bind(this);
  }

  async getAll(req, res, next) {
    return this.respond(() => this.getService().getConsolidated(readObject(req.query)), res, next);
  }
  async getFinancial(req, res, next) {
    return this.respond(() => this.getService().getFinancial(readObject(req.query)), res, next);
  }
  async getInstallments(req, res, next) {
    return this.respond(() => this.getService().getInstallments(readObject(req.query)), res, next);
  }
  async getDelinquency(req, res, next) {
    return this.respond(() => this.getService().getDelinquency(readObject(req.query)), res, next);
  }
  async getPix(req, res, next) {
    return this.respond(() => this.getService().getPix(readObject(req.query)), res, next);
  }
  async getAutomations(req, res, next) {
    return this.respond(() => this.getService().getAutomations(readObject(req.query)), res, next);
  }
  async exportPdf(req, res, next) {
    return this.respondExport("pdf", req, res, next);
  }
  async exportXlsx(req, res, next) {
    return this.respondExport("xlsx", req, res, next);
  }
  async exportCsv(req, res, next) {
    return this.respondExport("csv", req, res, next);
  }

  async respond(operation, res, next) {
    try {
      return res.json({ data: await operation(), success: true });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  async respondExport(format, req, res, next) {
    try {
      const file = await this.getService().export(readObject(req.query), format);
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.setHeader("Content-Length", String(file.buffer.length));
      return res.send(file.buffer);
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  getService() {
    if (!this.service || typeof this.service.getConsolidated !== "function") {
      throw Object.assign(
        new TypeError("FinancialReportController requires FinancialReportService."),
        { code: "FINANCIAL_REPORT_SERVICE_INVALID" },
      );
    }
    return this.service;
  }
}

function handleError(error, res, next) {
  if (CONTROLLED_CODES.has(error?.code)) {
    return res.status(400).json({ code: error.code, error: error.message, success: false });
  }
  return next(error);
}
function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = { FinancialReportController, handleError };
