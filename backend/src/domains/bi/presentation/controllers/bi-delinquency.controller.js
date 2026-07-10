const CONTROLLED = new Set(["BI_FILTER_INVALID", "BI_PERIOD_INVALID"]);
class BiDelinquencyController {
  constructor(options = {}) {
    this.service = options.service || null;
    this.getAnalytics = this.getAnalytics.bind(this);
  }
  async getAnalytics(req, res, next) {
    try {
      return res.json({
        data: await this.getService().getAnalytics(req.query || {}),
        success: true,
      });
    } catch (error) {
      if (CONTROLLED.has(error?.code))
        return res.status(400).json({
          code: error.code,
          details: error.details || {},
          error: "Filtros do BI de inadimplencia invalidos.",
          success: false,
        });
      return next(error);
    }
  }
  getService() {
    if (!this.service || typeof this.service.getAnalytics !== "function")
      throw Object.assign(new TypeError("BiDelinquencyController requires service."), {
        code: "BI_DELINQUENCY_SERVICE_INVALID",
      });
    return this.service;
  }
}
module.exports = { BiDelinquencyController };
