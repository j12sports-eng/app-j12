const { Lead } = require("../domain/lead.js");
class CrmLeadService {
  constructor({ repository, authorizeUnit = () => true, now = () => new Date() } = {}) {
    this.repository = repository;
    this.authorizeUnit = authorizeUnit;
    this.now = now;
  }
  async create(input, context) {
    this.authorize(context, input.unitId);
    const lead = new Lead({ ...input, createdBy: context.userId });
    const duplicate = await this.repository.findByContactIdentity({
      unitId: lead.unitId,
      email: lead.contactEmail,
      phone: lead.contactPhone,
    });
    if (duplicate) return { created: false, lead: duplicate };
    return { created: true, lead: await this.repository.create(lead) };
  }
  async changeStage(id, stage, context) {
    return this.transition(
      id,
      context,
      (lead) => lead.changeStage(stage, context.userId, this.now().toISOString()),
      "STAGE_CHANGED",
    );
  }
  async moveLeadToStage(
    {
      leadId,
      nextStage,
      reason = null,
      expectedStage = undefined,
      expectedStatus = undefined,
    } = {},
    context,
  ) {
    if (!leadId)
      throw Object.assign(new TypeError("CRM leadId required."), { code: "CRM_INPUT_INVALID" });
    validateSnapshot(
      expectedStage,
      ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
      "expectedStage",
    );
    validateSnapshot(expectedStatus, ["OPEN", "CONVERTED", "LOST", "ARCHIVED"], "expectedStatus");
    validateMetadata(arguments[0]?.metadata);
    this.authorize(context, context.unitId);
    const currentRecord = await this.repository.findById({ id: leadId, unitId: context.unitId });
    if (!currentRecord)
      throw Object.assign(new Error("CRM lead not found."), { code: "CRM_LEAD_NOT_FOUND" });
    const current = Lead.fromPersistence(currentRecord);
    const next = current.moveTo(nextStage, {
      actor: context.userId,
      at: this.now().toISOString(),
      reason,
    });
    const saved = await this.repository.saveStageTransition({
      leadId,
      unitId: context.unitId,
      expectedStage: expectedStage ?? current.stage,
      expectedStatus: expectedStatus ?? current.status,
      next,
      action: "STAGE_CHANGED",
      actorId: context.userId,
    });
    return Object.freeze({
      id: saved?.id || next.id,
      leadId,
      unitId: context.unitId,
      stage: saved?.stage || next.stage,
      status: saved?.status || next.status,
      updatedAt: saved?.updatedAt || saved?.updated_at || next.updatedAt,
      previousStage: current.stage,
      previousStatus: current.status,
      nextStage: next.stage,
      nextStatus: next.status,
    });
  }
  async getLeadStageHistory(leadId, context) {
    this.authorize(context, context.unitId);
    return this.repository.listStageHistory({ leadId, unitId: context.unitId });
  }
  async convert(id, context) {
    return this.transition(
      id,
      context,
      (lead) => lead.convert(context.userId, this.now().toISOString()),
      "CONVERTED",
    );
  }
  async lose(id, reason, context) {
    return this.transition(
      id,
      context,
      (lead) => lead.lose(reason, context.userId, this.now().toISOString()),
      "LOST",
    );
  }
  async transition(id, context, apply, action) {
    this.authorize(context, context.unitId);
    const current = await this.repository.findById({ id, unitId: context.unitId });
    if (!current)
      throw Object.assign(new Error("CRM lead not found."), { code: "CRM_LEAD_NOT_FOUND" });
    const next = apply(new Lead(current));
    if (next === current || (next.status === current.status && next.stage === current.stage))
      return current;
    return this.repository.saveTransition({ current, next, action, actorId: context.userId });
  }
  authorize(context, unitId) {
    if (!context?.userId || !unitId || !this.authorizeUnit(context, unitId))
      throw Object.assign(new Error("CRM access denied."), { code: "CRM_ACCESS_DENIED" });
  }
}
function validateSnapshot(value, allowed, field) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw Object.assign(new TypeError("CRM stage precondition is invalid."), {
      code: "CRM_INPUT_INVALID",
      details: { field },
    });
  }
}
function validateMetadata(value) {
  if (value == null) return;
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw invalidMetadata();
  }
  if (!serialized || serialized.length > 4096) throw invalidMetadata();
}
function invalidMetadata() {
  return Object.assign(new TypeError("CRM metadata invalid."), { code: "CRM_METADATA_INVALID" });
}
module.exports = { CrmLeadService };
