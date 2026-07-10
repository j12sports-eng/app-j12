const CONTROLLED_CODES = new Set(["BI_FILTER_INVALID", "BI_PERIOD_INVALID"]);

class BiExecutiveController {
  constructor(options = {}) {
    this.service = options.service || options.executiveService || null;
    this.getDashboard = this.getDashboard.bind(this);
  }

  async getDashboard(req, res, next) {
    try {
      return res.json({
        data: await this.getService().getDashboard(req.query || {}),
        success: true,
      });
    } catch (error) {
      if (CONTROLLED_CODES.has(error?.code)) {
        return res.status(400).json({
          code: error.code,
          details: error.details || {},
          error: "Filtros do dashboard executivo invalidos.",
          success: false,
        });
      }
      return next(error);
    }
  }

  getService() {
    if (!this.service || typeof this.service.getDashboard !== "function") {
      throw Object.assign(new TypeError("BiExecutiveController requires BiExecutiveService."), {
        code: "BI_EXECUTIVE_SERVICE_INVALID",
      });
    }
    return this.service;
  }
}

module.exports = { BiExecutiveController };
