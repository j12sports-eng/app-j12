const { Lead } = require("../domain/lead.js");
class CrmLeadService {
  constructor({ repository, authorizeUnit = () => true, now = () => new Date() } = {}) { this.repository = repository; this.authorizeUnit = authorizeUnit; this.now = now; }
  async create(input, context) { this.authorize(context, input.unitId); const lead = new Lead({ ...input, createdBy: context.userId }); const duplicate = await this.repository.findByContactIdentity({ unitId: lead.unitId, email: lead.contactEmail, phone: lead.contactPhone }); if (duplicate) return { created: false, lead: duplicate }; return { created: true, lead: await this.repository.create(lead) }; }
  async changeStage(id, stage, context) { return this.transition(id, context, (lead) => lead.changeStage(stage, context.userId, this.now().toISOString()), "STAGE_CHANGED"); }
  async convert(id, context) { return this.transition(id, context, (lead) => lead.convert(context.userId, this.now().toISOString()), "CONVERTED"); }
  async lose(id, reason, context) { return this.transition(id, context, (lead) => lead.lose(reason, context.userId, this.now().toISOString()), "LOST"); }
  async transition(id, context, apply, action) { this.authorize(context, context.unitId); const current = await this.repository.findById({ id, unitId: context.unitId }); if (!current) throw Object.assign(new Error("CRM lead not found."), { code: "CRM_LEAD_NOT_FOUND" }); const next = apply(new Lead(current)); if (next === current || (next.status === current.status && next.stage === current.stage)) return current; return this.repository.saveTransition({ current, next, action, actorId: context.userId }); }
  authorize(context, unitId) { if (!context?.userId || !unitId || !this.authorizeUnit(context, unitId)) throw Object.assign(new Error("CRM access denied."), { code: "CRM_ACCESS_DENIED" }); }
}
module.exports = { CrmLeadService };
