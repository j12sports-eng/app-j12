class CrmPipelineController {
  constructor({ pipelineService = null } = {}) {
    this.pipelineService = pipelineService;
    this.get = this.get.bind(this);
  }

  async get(req, res, next) {
    try {
      assertEmptyQuery(req.query);
      return res.status(200).json({
        success: true,
        data: this.getPipelineService().getPipeline(),
      });
    } catch (error) {
      return next(error);
    }
  }

  getPipelineService() {
    if (typeof this.pipelineService?.getPipeline !== "function") {
      throw new TypeError("CrmPipelineController requires pipelineService.");
    }
    return this.pipelineService;
  }
}

function assertEmptyQuery(query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).length) {
    throw Object.assign(new TypeError("CRM pipeline input is invalid."), {
      code: "CRM_INPUT_INVALID",
      details: null,
      expose: true,
      statusCode: 400,
    });
  }
}

module.exports = { CrmPipelineController, assertEmptyQuery };
