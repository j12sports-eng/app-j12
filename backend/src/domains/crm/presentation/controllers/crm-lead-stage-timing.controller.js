const { requiredId } = require("../../application/crm-lead-stage-timing-query.service.js");

class CrmLeadStageTimingController {
  constructor({ queryService = null } = {}) {
    this.queryService = queryService;
    this.getByLeadId = this.getByLeadId.bind(this);
  }

  async getByLeadId(req, res, next) {
    try {
      const leadId = requiredId(req.params?.leadId, "leadId");
      const unitId = readUnitFilter(req.query);
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().getLeadStageTiming({ leadId, unitId }),
      });
    } catch (error) {
      return next(error);
    }
  }

  getQueryService() {
    if (typeof this.queryService?.getLeadStageTiming !== "function") {
      throw new TypeError("CrmLeadStageTimingController requires queryService.");
    }
    return this.queryService;
  }
}

function readUnitFilter(query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return invalid("query");
  const unknown = Object.keys(query).filter((key) => key !== "unitId");
  if (unknown.length) return invalid(unknown[0]);
  return query.unitId == null ? null : requiredId(query.unitId, "unitId");
}

function invalid(field) {
  throw Object.assign(new TypeError("CRM stage timing input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

module.exports = { CrmLeadStageTimingController, readUnitFilter };
