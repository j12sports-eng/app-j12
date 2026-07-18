const CRM_LEAD_ENROLLMENT_HTTP_INPUT_REQUIRED = "CRM_LEAD_ENROLLMENT_HTTP_INPUT_REQUIRED";

/** Thin HTTP adapter for the Sprint 27.17D application service. */
class CrmLeadEnrollmentConversionController {
  constructor({ conversionService = null } = {}) {
    this.conversionService = conversionService;
    this.convert = this.convert.bind(this);
  }

  async convert(req, res, next) {
    try {
      const input = readConversionInput(req);
      const context = readConversionContext(req);
      const missingFields = [];
      if (!input.leadId) missingFields.push("leadId");
      if (!context.unitId) missingFields.push("unitId");
      if (missingFields.length) {
        return res.status(400).json({ code: CRM_LEAD_ENROLLMENT_HTTP_INPUT_REQUIRED, error: "leadId and unitId are required.", missingFields, success: false });
      }
      const data = await this.getConversionService().convertLeadToDraftEnrollment(input, context);
      return res.status(200).json({ data, success: true });
    } catch (error) { return next(error); }
  }

  getConversionService() {
    if (typeof this.conversionService?.convertLeadToDraftEnrollment !== "function") throw new TypeError("CrmLeadEnrollmentConversionController requires conversionService.");
    return this.conversionService;
  }
}

function readConversionInput(req = {}) {
  const body = object(req.body); const params = object(req.params);
  return { ...body, leadId: text(params.leadId) };
}
function readConversionContext(req = {}) {
  const body = object(req.body); const user = req.auth || req.user || {};
  return Object.freeze({ unitId: text(body.unitId), userId: text(user.id) });
}
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function text(value) { const normalized = String(value ?? "").trim(); return normalized || null; }

module.exports = { CRM_LEAD_ENROLLMENT_HTTP_INPUT_REQUIRED, CrmLeadEnrollmentConversionController, readConversionContext, readConversionInput };
