const BAD_REQUEST = new Set([
  "BI_EXPORT_FORMAT_INVALID",
  "BI_EXPORT_REPORT_INVALID",
  "BI_FILTER_INVALID",
  "BI_PERIOD_INVALID",
]);
class BiExportController {
  constructor(options = {}) {
    this.service = options.service || null;
    this.export = this.export.bind(this);
  }
  async export(req, res, next) {
    try {
      const file = await this.getService().export({
        format: req.params?.format,
        query: req.query || {},
        report: req.params?.report,
      });
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.setHeader("Content-Length", String(file.buffer.length));
      res.setHeader("X-BI-Export-Rows", String(file.rows));
      return res.send(file.buffer);
    } catch (error) {
      if (BAD_REQUEST.has(error?.code)) {
        return res.status(400).json({
          code: error.code,
          details: error.details,
          error: error.message,
          success: false,
        });
      }
      if (error?.code === "BI_EXPORT_LIMIT_EXCEEDED") {
        return res.status(413).json({ code: error.code, details: error.details, success: false });
      }
      if (error?.code === "BI_EXPORT_TIMEOUT") {
        return res.status(504).json({ code: error.code, success: false });
      }
      return next(error);
    }
  }
  getService() {
    if (!this.service || typeof this.service.export !== "function") {
      throw new TypeError("BiExportController requires service.");
    }
    return this.service;
  }
}
module.exports = { BiExportController };
