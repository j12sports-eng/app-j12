const { randomUUID } = require("node:crypto");

const ActivityType = Object.freeze({
  CALL: "CALL", WHATSAPP: "WHATSAPP", EMAIL: "EMAIL", MEETING: "MEETING",
  VISIT: "VISIT", TASK: "TASK", NOTE: "NOTE", SYSTEM: "SYSTEM",
});
const ActivityStatus = Object.freeze({ PENDING: "PENDING", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" });
const TYPES = new Set(Object.values(ActivityType));
const STATUSES = new Set(Object.values(ActivityStatus));

class CrmActivity {
  constructor(input = {}, options = {}) {
    this.id = text(input.id, 64) || randomUUID();
    this.leadId = required(input.leadId, "leadId", 64);
    this.unitId = required(input.unitId, "unitId", 64);
    this.activityType = requiredType(input.activityType);
    this.subject = required(input.subject, "subject", 191);
    this.description = nullableText(input.description, 4000);
    this.scheduledAt = dateOrNull(input.scheduledAt, "scheduledAt");
    this.createdAt = dateOrDefault(input.createdAt, "createdAt");
    this.createdBy = required(input.createdBy, "createdBy", 191);
    this.metadata = validateMetadata(input.metadata);

    if (options.rehydrate) {
      this.status = requiredStatus(input.status);
      this.completedAt = dateOrNull(input.completedAt, "completedAt");
    } else {
      this.status = this.activityType === ActivityType.TASK ? ActivityStatus.PENDING : ActivityStatus.COMPLETED;
      this.completedAt = this.status === ActivityStatus.COMPLETED
        ? dateOrDefault(input.completedAt || this.createdAt, "completedAt") : null;
    }
    assertState(this);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  static rehydrate(input) { return new CrmActivity(input, { rehydrate: true }); }

  complete(at = new Date().toISOString()) {
    this.assertPendingTask();
    return CrmActivity.rehydrate({ ...this, status: ActivityStatus.COMPLETED, completedAt: dateOrDefault(at, "completedAt") });
  }

  cancel() {
    this.assertPendingTask();
    return CrmActivity.rehydrate({ ...this, status: ActivityStatus.CANCELLED, completedAt: null });
  }

  assertPendingTask() {
    if (this.activityType !== ActivityType.TASK) throw domainError("CRM_ACTIVITY_NOT_TASK");
    if (this.status !== ActivityStatus.PENDING) throw domainError("CRM_ACTIVITY_NOT_PENDING");
  }
}

function assertState(activity) {
  if (activity.status === ActivityStatus.PENDING && activity.activityType !== ActivityType.TASK) throw domainError("CRM_ACTIVITY_STATUS_INVALID");
  if (activity.status === ActivityStatus.COMPLETED && !activity.completedAt) throw domainError("CRM_ACTIVITY_COMPLETED_AT_REQUIRED");
  if (activity.status !== ActivityStatus.COMPLETED && activity.completedAt) throw domainError("CRM_ACTIVITY_COMPLETED_AT_INVALID");
}
function validateMetadata(value) {
  if (value == null) return Object.freeze({});
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw domainError("CRM_ACTIVITY_METADATA_INVALID"); }
  if (!serialized || serialized.length > 4096) throw domainError("CRM_ACTIVITY_METADATA_INVALID");
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw domainError("CRM_ACTIVITY_METADATA_INVALID");
  return parsed;
}
function requiredType(value) { if (!TYPES.has(value)) throw domainError("CRM_ACTIVITY_TYPE_INVALID"); return value; }
function requiredStatus(value) { if (!STATUSES.has(value)) throw domainError("CRM_ACTIVITY_STATUS_INVALID"); return value; }
function required(value, field, max) { const result = text(value, max); if (!result) throw inputError(field); return result; }
function nullableText(value, max) { const result = text(value, max); return result || null; }
function text(value, max) { return typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0, max) : ""; }
function dateOrDefault(value, field) { return dateOrNull(value || new Date().toISOString(), field); }
function dateOrNull(value, field) { if (value == null || value === "") return null; const date = new Date(value); if (Number.isNaN(date.getTime())) throw inputError(field); return date.toISOString(); }
function inputError(field) { return Object.assign(new TypeError(`CRM activity ${field} required or invalid.`), { code: "CRM_ACTIVITY_INPUT_INVALID", details: { field } }); }
function domainError(code) { return Object.assign(new Error(code), { code }); }

module.exports = { ActivityStatus, ActivityType, CrmActivity };
