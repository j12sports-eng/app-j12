const ALLOWED_BODY_FIELDS = new Set(["enrollmentData", "idempotencyKey", "studentData"]);

/** Thin HTTP adapter: validates the envelope and keeps input separate from trusted context. */
class CrmLeadEnrollmentConversionController {
  constructor({ conversionService = null, leadUnitContextService = null } = {}) {
    this.conversionService = conversionService;
    this.leadUnitContextService = leadUnitContextService;
    this.convert = this.convert.bind(this);
  }

  async convert(req, res, next) {
    try {
      const input = readConversionInput(req);
      const context = await this.getLeadUnitContextService().resolve({
        authenticatedUser: req.auth || req.user || null,
        authorization: req.crmAuthorization,
        correlationId: req.correlationId || req.id || null,
        leadId: input.leadId,
      });
      const data = await this.getConversionService().convertLeadToDraftEnrollment(input, context);
      return res.status(200).json({ data, success: true });
    } catch (error) {
      return next(error);
    }
  }

  getConversionService() {
    if (typeof this.conversionService?.convertLeadToDraftEnrollment !== "function") {
      throw new TypeError("CrmLeadEnrollmentConversionController requires conversionService.");
    }
    return this.conversionService;
  }

  getLeadUnitContextService() {
    if (typeof this.leadUnitContextService?.resolve !== "function") {
      throw new TypeError("CrmLeadEnrollmentConversionController requires leadUnitContextService.");
    }
    return this.leadUnitContextService;
  }
}

function readConversionInput(req = {}) {
  const body = object(req.body);
  const extraFields = Object.keys(body).filter((field) => !ALLOWED_BODY_FIELDS.has(field));
  if (extraFields.length) {
    throw Object.assign(new Error("CRM conversion input is invalid."), {
      code: "CRM_INPUT_INVALID",
      details: { fields: extraFields },
      expose: true,
      statusCode: 422,
    });
  }
  return {
    leadId: text(object(req.params).leadId),
    studentData: body.studentData,
    enrollmentData: body.enrollmentData,
    idempotencyKey: body.idempotencyKey,
  };
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

module.exports = {
  ALLOWED_BODY_FIELDS,
  CrmLeadEnrollmentConversionController,
  readConversionInput,
};
