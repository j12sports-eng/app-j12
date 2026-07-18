const ALLOWED_BODY_FIELDS = new Set(["expectedStage", "expectedStatus", "nextStage", "reason"]);
const STAGES = new Set(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
const STATUSES = new Set(["OPEN", "CONVERTED", "LOST", "ARCHIVED"]);

class CrmLeadStageTransitionController {
  constructor({ leadService = null, leadUnitContextService = null } = {}) {
    this.leadService = leadService;
    this.leadUnitContextService = leadUnitContextService;
    this.move = this.move.bind(this);
  }

  async move(req, res, next) {
    try {
      const input = readStageTransitionInput(req);
      const context = await this.getUnitContextService().resolve({
        authenticatedUser: req.auth || req.user || null,
        authorization: req.crmAuthorization,
        correlationId: req.correlationId || req.id || null,
        leadId: input.leadId,
      });
      const data = await this.getLeadService().moveLeadToStage(input, context);
      return res.status(200).json({ data, success: true });
    } catch (error) {
      return next(error);
    }
  }

  getLeadService() {
    if (typeof this.leadService?.moveLeadToStage !== "function") {
      throw new TypeError("CrmLeadStageTransitionController requires leadService.");
    }
    return this.leadService;
  }

  getUnitContextService() {
    if (typeof this.leadUnitContextService?.resolve !== "function") {
      throw new TypeError("CrmLeadStageTransitionController requires leadUnitContextService.");
    }
    return this.leadUnitContextService;
  }
}

function readStageTransitionInput(req = {}) {
  const body = plainObject(req.body);
  const unknown = Object.keys(body).filter((field) => !ALLOWED_BODY_FIELDS.has(field));
  if (unknown.length) throw inputError(unknown[0]);

  const leadId = readId(plainObject(req.params).leadId, "leadId");
  const nextStage = readEnum(body.nextStage, STAGES, "nextStage", true);
  const expectedStage = readEnum(body.expectedStage, STAGES, "expectedStage", false);
  const expectedStatus = readEnum(body.expectedStatus, STATUSES, "expectedStatus", false);
  const reason = body.reason == null ? null : readText(body.reason, "reason");
  return { expectedStage, expectedStatus, leadId, nextStage, reason };
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("body");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw inputError("body");
  return value;
}

function readEnum(value, allowed, field, required) {
  if (value == null || value === "") {
    if (required) throw inputError(field);
    return undefined;
  }
  if (typeof value !== "string" || !allowed.has(value)) throw inputError(field);
  return value;
}

function readId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim())) {
    throw inputError(field);
  }
  return value.trim();
}

function readText(value, field) {
  if (typeof value !== "string" || value.length > 191) throw inputError(field);
  return value;
}

function inputError(field) {
  return Object.assign(new TypeError("CRM stage transition input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  ALLOWED_BODY_FIELDS,
  CrmLeadStageTransitionController,
  readStageTransitionInput,
};
