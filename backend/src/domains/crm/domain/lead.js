const { randomUUID } = require("node:crypto");
const LeadStatus = Object.freeze({ OPEN: "OPEN", CONVERTED: "CONVERTED", LOST: "LOST", ARCHIVED: "ARCHIVED" });
const LeadStage = Object.freeze({ NEW: "NEW", CONTACTED: "CONTACTED", QUALIFIED: "QUALIFIED", TRIAL_SCHEDULED: "TRIAL_SCHEDULED", TRIAL_COMPLETED: "TRIAL_COMPLETED", NEGOTIATION: "NEGOTIATION" });
const STAGES = new Set(Object.values(LeadStage));
class Lead {
  constructor(input = {}) {
    this.id = text(input.id, 64) || randomUUID();
    this.unitId = required(input.unitId, "unitId", 64);
    this.source = required(input.source, "source", 64);
    this.stage = STAGES.has(input.stage) ? input.stage : LeadStage.NEW;
    this.status = Object.values(LeadStatus).includes(input.status) ? input.status : LeadStatus.OPEN;
    this.assignedTo = text(input.assignedTo, 64); this.personId = text(input.personId, 64);
    this.contactName = required(input.contactName, "contactName", 191);
    this.contactEmail = email(input.contactEmail); this.contactPhone = phone(input.contactPhone);
    this.qualifiedAt = input.qualifiedAt || null; this.convertedAt = input.convertedAt || null;
    this.lostAt = input.lostAt || null; this.lostReason = text(input.lostReason, 191);
    this.createdAt = input.createdAt || new Date().toISOString(); this.updatedAt = input.updatedAt || this.createdAt;
    this.createdBy = required(input.createdBy, "createdBy", 191); this.updatedBy = text(input.updatedBy, 191) || this.createdBy;
    Object.freeze(this);
  }
  changeStage(stage, actor, at = new Date().toISOString()) {
    this.assertOpen(); if (!STAGES.has(stage)) throw domainError("CRM_STAGE_INVALID");
    if (stage === this.stage) return this;
    return this.copy({ stage, qualifiedAt: stage === LeadStage.QUALIFIED ? this.qualifiedAt || at : this.qualifiedAt, updatedAt: at, updatedBy: required(actor, "actor", 191) });
  }
  convert(actor, at = new Date().toISOString()) { if (this.status === LeadStatus.CONVERTED) return this; this.assertOpen(); return this.copy({ status: LeadStatus.CONVERTED, convertedAt: at, updatedAt: at, updatedBy: required(actor, "actor", 191) }); }
  lose(reason, actor, at = new Date().toISOString()) { if (this.status === LeadStatus.LOST) return this; this.assertOpen(); return this.copy({ status: LeadStatus.LOST, lostAt: at, lostReason: required(reason, "lostReason", 191), updatedAt: at, updatedBy: required(actor, "actor", 191) }); }
  archive(actor, at = new Date().toISOString()) { if (this.status === LeadStatus.ARCHIVED) return this; if (this.status === LeadStatus.ARCHIVED) return this; return this.copy({ status: LeadStatus.ARCHIVED, updatedAt: at, updatedBy: required(actor, "actor", 191) }); }
  assertOpen() { if (this.status !== LeadStatus.OPEN) throw domainError("CRM_LEAD_TERMINAL"); }
  copy(changes) { return new Lead({ ...this, ...changes }); }
}
function domainError(code) { return Object.assign(new Error(code), { code }); }
function required(value, field, max) { const result = text(value, max); if (!result) throw Object.assign(new TypeError(`CRM ${field} required.`), { code: "CRM_INPUT_INVALID", details: { field } }); return result; }
function text(value, max) { return typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0, max) : ""; }
function email(value) { const result = text(value, 191).toLowerCase(); return result && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(result) ? result : null; }
function phone(value) { const result = typeof value === "string" ? value.replace(/\D/g, "").slice(0, 15) : ""; return result.length >= 10 ? result : null; }
module.exports = { Lead, LeadStage, LeadStatus };
