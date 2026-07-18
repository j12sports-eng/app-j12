const { randomUUID } = require("node:crypto");
const LeadStatus = Object.freeze({
  OPEN: "OPEN",
  CONVERTED: "CONVERTED",
  LOST: "LOST",
  ARCHIVED: "ARCHIVED",
});
const { assertLeadStageTransition } = require("./lead-stage-transition-policy.js");
const LeadStage = Object.freeze({
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  PROPOSAL: "PROPOSAL",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
  TRIAL_SCHEDULED: "TRIAL_SCHEDULED",
  TRIAL_COMPLETED: "TRIAL_COMPLETED",
});
const STAGES = new Set(Object.values(LeadStage));
class Lead {
  constructor(input = {}) {
    this.id = text(input.id, 64) || randomUUID();
    this.unitId = required(input.unitId, "unitId", 64);
    this.source = required(input.source, "source", 64);
    this.stage = STAGES.has(input.stage) ? input.stage : LeadStage.NEW;
    this.status = Object.values(LeadStatus).includes(input.status) ? input.status : LeadStatus.OPEN;
    this.assignedTo = text(input.assignedTo, 64);
    this.personId = text(input.personId, 64);
    this.contactName = required(input.contactName, "contactName", 191);
    this.contactEmail = email(input.contactEmail);
    this.contactPhone = phone(input.contactPhone);
    this.qualifiedAt = input.qualifiedAt || null;
    this.convertedAt = input.convertedAt || null;
    this.lostAt = input.lostAt || null;
    this.lostReason = text(input.lostReason, 191);
    this.createdAt = input.createdAt || new Date().toISOString();
    this.updatedAt = input.updatedAt || this.createdAt;
    this.createdBy = required(input.createdBy, "createdBy", 191);
    this.updatedBy = text(input.updatedBy, 191) || this.createdBy;
    Object.freeze(this);
  }
  static fromPersistence(input = {}) {
    return new Lead({
      ...input,
      assignedTo: input.assignedTo ?? input.assigned_to,
      contactEmail: input.contactEmail ?? input.contact_email,
      contactName: input.contactName ?? input.contact_name,
      contactPhone: input.contactPhone ?? input.contact_phone,
      createdAt: input.createdAt ?? input.created_at,
      createdBy: input.createdBy ?? input.created_by ?? input.updated_by ?? "system",
      lostAt: input.lostAt ?? input.lost_at,
      lostReason: input.lostReason ?? input.lost_reason,
      unitId: input.unitId ?? input.unit_id,
      updatedAt: input.updatedAt ?? input.updated_at,
      updatedBy: input.updatedBy ?? input.updated_by,
    });
  }
  changeStage(stage, actor, at = new Date().toISOString()) {
    this.assertOpen();
    if (!STAGES.has(stage)) throw domainError("CRM_STAGE_INVALID");
    if (stage === this.stage) return this;
    return this.copy({
      stage,
      qualifiedAt: stage === LeadStage.QUALIFIED ? this.qualifiedAt || at : this.qualifiedAt,
      updatedAt: at,
      updatedBy: required(actor, "actor", 191),
    });
  }
  canMoveTo(stage) {
    try {
      this.assertOpen();
      assertLeadStageTransition(this.stage, stage);
      return true;
    } catch {
      return false;
    }
  }
  isTerminal() {
    return (
      this.status !== LeadStatus.OPEN ||
      this.stage === LeadStage.WON ||
      this.stage === LeadStage.LOST
    );
  }
  moveTo(stage, { actor, at = new Date().toISOString(), reason = null } = {}) {
    this.assertOpen();
    assertLeadStageTransition(this.stage, stage);
    const lostReason =
      stage === LeadStage.LOST ? sanitizeLostReason(reason, this) : this.lostReason;
    return this.copy({
      stage,
      status:
        stage === LeadStage.WON
          ? LeadStatus.CONVERTED
          : stage === LeadStage.LOST
            ? LeadStatus.LOST
            : this.status,
      qualifiedAt: stage === LeadStage.QUALIFIED ? this.qualifiedAt || at : this.qualifiedAt,
      convertedAt: stage === LeadStage.WON ? this.convertedAt || at : this.convertedAt,
      lostAt: stage === LeadStage.LOST ? this.lostAt || at : this.lostAt,
      lostReason,
      updatedAt: at,
      updatedBy: required(actor, "actor", 191),
    });
  }
  convert(actor, at = new Date().toISOString()) {
    if (this.status === LeadStatus.CONVERTED) return this;
    this.assertOpen();
    return this.copy({
      status: LeadStatus.CONVERTED,
      convertedAt: at,
      updatedAt: at,
      updatedBy: required(actor, "actor", 191),
    });
  }
  lose(reason, actor, at = new Date().toISOString()) {
    if (this.status === LeadStatus.LOST) return this;
    this.assertOpen();
    return this.copy({
      status: LeadStatus.LOST,
      lostAt: at,
      lostReason: required(reason, "lostReason", 191),
      updatedAt: at,
      updatedBy: required(actor, "actor", 191),
    });
  }
  archive(actor, at = new Date().toISOString()) {
    if (this.status === LeadStatus.ARCHIVED) return this;
    if (this.status === LeadStatus.ARCHIVED) return this;
    return this.copy({
      status: LeadStatus.ARCHIVED,
      updatedAt: at,
      updatedBy: required(actor, "actor", 191),
    });
  }
  assertOpen() {
    if (this.status !== LeadStatus.OPEN) throw domainError("CRM_LEAD_TERMINAL");
  }
  copy(changes) {
    return new Lead({ ...this, ...changes });
  }
}
function sanitizeLostReason(value, lead) {
  const reason = text(value, 191);
  if (!reason) throw domainError("CRM_LOST_REASON_REQUIRED");
  const lowerReason = reason.toLowerCase();
  const blocked = [lead.contactName, lead.contactEmail, lead.contactPhone]
    .map((item) => text(item, 191).toLowerCase())
    .filter((item) => item.length >= 3);
  const digits = reason.replace(/\D/g, "");
  if (
    blocked.some((item) => lowerReason.includes(item)) ||
    digits.length >= 10 ||
    /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(reason)
  ) {
    throw Object.assign(new TypeError("CRM loss reason contains restricted data."), {
      code: "CRM_INPUT_INVALID",
      details: { field: "reason" },
    });
  }
  return reason;
}
function domainError(code) {
  return Object.assign(new Error(code), { code });
}
function required(value, field, max) {
  const result = text(value, max);
  if (!result)
    throw Object.assign(new TypeError(`CRM ${field} required.`), {
      code: "CRM_INPUT_INVALID",
      details: { field },
    });
  return result;
}
function text(value, max) {
  return typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0, max) : "";
}
function email(value) {
  const result = text(value, 191).toLowerCase();
  return result && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(result) ? result : null;
}
function phone(value) {
  const result = typeof value === "string" ? value.replace(/\D/g, "").slice(0, 15) : "";
  return result.length >= 10 ? result : null;
}
module.exports = { Lead, LeadStage, LeadStatus, sanitizeLostReason };
