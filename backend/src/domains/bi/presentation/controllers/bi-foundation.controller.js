const { BiFoundationService } = require("../../application/index.js");

class BiFoundationController {
  constructor(options = {}) {
    this.service = options.service || new BiFoundationService(options);
    this.describe = this.describe.bind(this);
  }

  async describe(req, res, next) {
    try {
      return res.json({ success: true, data: this.service.describe(req.query || {}) });
    } catch (error) {
      const inputError = ["BI_FILTER_INVALID", "BI_PERIOD_INVALID"].includes(error?.code);
      if (!inputError) return next(error);
      return res.status(400).json({
        success: false,
        code: error.code,
        error: "Filtros de BI invalidos.",
        ...(error?.details ? { details: error.details } : {}),
      });
    }
  }
}

module.exports = { BiFoundationController };
