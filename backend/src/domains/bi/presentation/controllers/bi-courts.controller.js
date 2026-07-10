const CONTROLLED = new Set(["BI_FILTER_INVALID", "BI_PERIOD_INVALID"]);
class BiCourtsController {
  constructor(o = {}) {
    this.service = o.service || null;
    this.getAnalytics = this.getAnalytics.bind(this);
  }
  async getAnalytics(req, res, next) {
    try {
      return res.json({ data: await this.get().getAnalytics(req.query || {}), success: true });
    } catch (e) {
      if (CONTROLLED.has(e?.code))
        return res.status(400).json({
          code: e.code,
          details: e.details || {},
          error: "Filtros do BI de quadras invalidos.",
          success: false,
        });
      return next(e);
    }
  }
  get() {
    if (!this.service || typeof this.service.getAnalytics !== "function")
      throw new TypeError("BiCourtsController requires service.");
    return this.service;
  }
}
module.exports = { BiCourtsController };
