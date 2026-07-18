const CRM_LEAD_UNIT_CONTEXT_ERROR_CODES = Object.freeze({
  ACCESS_DENIED: "CRM_ACCESS_DENIED",
  FAILED: "CRM_LEAD_UNIT_CONTEXT_FAILED",
  LEAD_NOT_FOUND: "CRM_LEAD_NOT_FOUND",
  UNAVAILABLE: "CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE",
});

/** Resolves the Lead unit and builds trusted context without executing conversion rules. */
class CrmLeadUnitContextService {
  constructor({ leadRepository = null } = {}) {
    this.leadRepository = leadRepository;
  }

  async resolve({ authenticatedUser, authorization, correlationId, leadId } = {}) {
    const userId = text(authenticatedUser?.id);
    if (!userId || authorization?.granted !== true) {
      throw crmContextError(
        "CRM access denied.",
        CRM_LEAD_UNIT_CONTEXT_ERROR_CODES.ACCESS_DENIED,
        403,
      );
    }

    let leadContext;
    try {
      leadContext = await this.getLeadRepository().findUnitContextById(text(leadId));
    } catch {
      throw crmContextError(
        "CRM Lead unit context resolution failed.",
        CRM_LEAD_UNIT_CONTEXT_ERROR_CODES.FAILED,
        500,
      );
    }
    if (!leadContext) {
      throw crmContextError(
        "CRM Lead not found.",
        CRM_LEAD_UNIT_CONTEXT_ERROR_CODES.LEAD_NOT_FOUND,
        404,
      );
    }

    const unitId = text(leadContext.unitId ?? leadContext.unit_id);
    if (!unitId) {
      throw crmContextError(
        "CRM Lead unit context is unavailable.",
        CRM_LEAD_UNIT_CONTEXT_ERROR_CODES.UNAVAILABLE,
        409,
      );
    }

    return Object.freeze({
      authorization: Object.freeze({
        granted: true,
        policy: text(authorization.policy),
        scope: text(authorization.scope),
      }),
      correlationId: text(correlationId),
      unitId,
      userId,
    });
  }

  getLeadRepository() {
    if (typeof this.leadRepository?.findUnitContextById !== "function") {
      throw new TypeError("CRM Lead repository with unit context lookup is required.");
    }
    return this.leadRepository;
  }
}

function crmContextError(message, code, statusCode) {
  return Object.assign(new Error(message), {
    code,
    details: null,
    expose: statusCode < 500,
    statusCode,
  });
}

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

module.exports = { CRM_LEAD_UNIT_CONTEXT_ERROR_CODES, CrmLeadUnitContextService };
