const BAD_REQUEST = new Set(["BI_FILTER_INVALID", "BI_PERIOD_INVALID"]);
class BiInsightsController {
  constructor({ service } = {}) {
    this.service = service;
    this.getInsights = this.getInsights.bind(this);
  }
  async getInsights(req, res, next) {
    try {
      return res.json({ data: await this.service.getInsights(req.query || {}), success: true });
    } catch (error) {
      if (BAD_REQUEST.has(error?.code))
        return res
          .status(400)
          .json({ code: error.code, details: error.details, error: error.message, success: false });
      return next(error);
    }
  }
}
module.exports = { BiInsightsController };
