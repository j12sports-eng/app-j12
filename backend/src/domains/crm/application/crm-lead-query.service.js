const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CURSOR_LENGTH = 256;
const CURSOR_VERSION = 1;

const STAGES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "TRIAL_SCHEDULED",
  "TRIAL_COMPLETED",
]);
const STATUSES = new Set(["OPEN", "CONVERTED", "LOST", "ARCHIVED"]);
const CONVERSION_STATUSES = new Set(["NONE", "STUDENT_COMPLETED", "ENROLLMENT_COMPLETED"]);
const { HISTORY_COVERAGE, TERMINAL_STAGES, utcIso } = require("../domain/crm-lead-stage-timing.js");
const { CrmLeadStageSlaPolicy } = require("../domain/crm-lead-stage-sla-policy.js");

class CrmLeadQueryService {
  constructor({ repository = null, clock = null, slaPolicy = null } = {}) {
    this.repository = repository;
    this.clock = clock || Object.freeze({ now: () => new Date() });
    this.slaPolicy = slaPolicy || new CrmLeadStageSlaPolicy();
  }

  async listLeads(filters = {}) {
    const normalized = normalizeFilters(filters);
    const decodedCursor = normalized.cursor ? decodeCursor(normalized.cursor) : null;
    let rows;
    try {
      rows = await this.getRepository().listLeadsForInternalQuery({
        ...normalized,
        cursor: decodedCursor,
        fetchLimit: normalized.limit + 1,
      });
    } catch {
      throw queryError("CRM Lead query failed.", "CRM_LEAD_QUERY_FAILED", 500);
    }

    const safeRows = Array.isArray(rows) ? rows : [];
    const hasNextPage = safeRows.length > normalized.limit;
    const measuredAt = utcIso(this.clock.now());
    if (!measuredAt) throw queryError("CRM Lead query failed.", "CRM_LEAD_QUERY_FAILED", 500);
    const items = safeRows
      .slice(0, normalized.limit)
      .map((row) => toListItem(row, { measuredAt, slaPolicy: this.slaPolicy }));
    const last = items.at(-1);
    return Object.freeze({
      items,
      pageInfo: Object.freeze({
        hasNextPage,
        nextCursor:
          hasNextPage && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
      }),
    });
  }

  async getLeadById({ leadId, unitId = null } = {}) {
    const normalizedLeadId = requiredId(leadId, "leadId");
    const normalizedUnitId = unitId == null ? null : requiredId(unitId, "unitId");
    let row;
    try {
      row = await this.getRepository().findLeadDetailForInternalQuery({
        leadId: normalizedLeadId,
        unitId: normalizedUnitId,
      });
    } catch {
      throw queryError("CRM Lead query failed.", "CRM_LEAD_QUERY_FAILED", 500);
    }
    if (!row) throw queryError("CRM Lead not found.", "CRM_LEAD_NOT_FOUND", 404);
    const measuredAt = utcIso(this.clock.now());
    if (!measuredAt) throw queryError("CRM Lead query failed.", "CRM_LEAD_QUERY_FAILED", 500);
    return toDetail(row, { measuredAt, slaPolicy: this.slaPolicy });
  }

  getRepository() {
    if (
      typeof this.repository?.listLeadsForInternalQuery !== "function" ||
      typeof this.repository?.findLeadDetailForInternalQuery !== "function"
    ) {
      throw new TypeError("CRM Lead query repository is required.");
    }
    return this.repository;
  }
}

function normalizeFilters(filters = {}) {
  const limit = parseLimit(filters.limit);
  const cursor = filters.cursor == null ? null : parseCursor(filters.cursor);
  const stage = optionalEnum(filters.stage, STAGES, "stage");
  const status = optionalEnum(filters.status, STATUSES, "status");
  const conversionStatus = optionalEnum(
    filters.conversionStatus,
    CONVERSION_STATUSES,
    "conversionStatus",
  );
  const unitId = filters.unitId == null ? null : requiredId(filters.unitId, "unitId");
  return Object.freeze({ conversionStatus, cursor, limit, stage, status, unitId });
}

function parseLimit(value) {
  if (value == null || value === "") return DEFAULT_LIMIT;
  if (Array.isArray(value) || !/^\d+$/.test(String(value))) throw inputError("limit");
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw inputError("limit");
  return limit;
}

function parseCursor(value) {
  if (Array.isArray(value) || typeof value !== "string" || value.length > MAX_CURSOR_LENGTH) {
    throw cursorError();
  }
  return value;
}

function decodeCursor(value) {
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw cursorError();
  }
  if (
    !decoded ||
    decoded.v !== CURSOR_VERSION ||
    !isValidDate(decoded.createdAt) ||
    !isSafeId(decoded.id)
  ) {
    throw cursorError();
  }
  return Object.freeze({ createdAt: new Date(decoded.createdAt).toISOString(), id: decoded.id });
}

function encodeCursor({ createdAt, id }) {
  return Buffer.from(
    JSON.stringify({ createdAt: new Date(createdAt).toISOString(), id, v: CURSOR_VERSION }),
    "utf8",
  ).toString("base64url");
}

function toListItem(row, timingOptions = null) {
  const eligibility = resolveEligibility(row);
  const item = {
    assignedTo: row.assigned_to ?? row.assignedTo ?? null,
    createdAt: iso(row.created_at ?? row.createdAt),
    eligibility,
    id: row.id,
    source: row.source ?? null,
    stage: row.stage,
    status: row.status,
    unitId: row.unit_id ?? row.unitId,
    updatedAt: iso(row.updated_at ?? row.updatedAt),
    conversions: conversionSummary(row),
  };
  if (timingOptions) item.stageTiming = toStageTimingSummary(row, timingOptions);
  return Object.freeze(item);
}

function toDetail(row, timingOptions = null) {
  const item = toListItem(row, timingOptions);
  return Object.freeze({
    ...item,
    contact: Object.freeze({
      email: row.contact_email ?? row.contactEmail ?? null,
      nome: row.contact_name ?? row.contactName ?? null,
      telefone: row.contact_phone ?? row.contactPhone ?? null,
    }),
    conversions: Object.freeze({
      ...item.conversions,
      student: Object.freeze({
        convertedAt: iso(row.student_converted_at ?? row.studentConvertedAt),
        personId: row.student_person_id ?? row.personId ?? null,
        personProfileId: row.student_person_profile_id ?? row.personProfileId ?? null,
        status: row.student_conversion_status ?? row.studentStatus ?? null,
      }),
      enrollment: Object.freeze({
        convertedAt: iso(row.enrollment_converted_at ?? row.enrollmentConvertedAt),
        enrollmentId: row.enrollment_id ?? row.enrollmentId ?? null,
        enrollmentStatus: row.enrollment_status ?? row.enrollmentStatus ?? null,
        status: row.enrollment_conversion_status ?? row.enrollmentStatusCode ?? null,
      }),
    }),
  });
}

function conversionSummary(row) {
  const studentCompleted = (row.student_conversion_status ?? row.studentStatus) === "COMPLETED";
  const enrollmentCompleted =
    (row.enrollment_conversion_status ?? row.enrollmentStatusCode) === "COMPLETED";
  return Object.freeze({
    enrollmentCompleted,
    enrollmentStatus: row.enrollment_status ?? row.enrollmentStatus ?? null,
    studentCompleted,
  });
}

function toStageTimingSummary(row, { measuredAt, slaPolicy }) {
  const historyStage = row.timing_history_stage ?? row.timingHistoryStage ?? null;
  const rawEntryAt = row.current_stage_entry_at ?? row.currentStageEntryAt ?? null;
  const entryAt = historyStage === row.stage ? utcIso(rawEntryAt) : null;
  const initialReliable = Boolean(
    Number(row.timing_initial_event_reliable ?? row.timingInitialEventReliable ?? 0),
  );
  let historyCoverage = entryAt
    ? initialReliable
      ? HISTORY_COVERAGE.COMPLETE
      : HISTORY_COVERAGE.PARTIAL
    : HISTORY_COVERAGE.UNAVAILABLE;
  let elapsedMs = entryAt ? Math.max(0, Date.parse(measuredAt) - Date.parse(entryAt)) : null;
  if (entryAt && Date.parse(entryAt) > Date.parse(measuredAt))
    historyCoverage = HISTORY_COVERAGE.PARTIAL;
  if (TERMINAL_STAGES.has(row.stage) && elapsedMs != null) elapsedMs = 0;
  return Object.freeze({
    currentStageElapsedMs: elapsedMs,
    currentStageEntryAt: entryAt,
    historyCoverage,
    measuredAt,
    sla: slaPolicy.evaluate({ elapsedMs, historyCoverage, stage: row.stage }),
  });
}

function resolveEligibility(row) {
  const stage = row.stage;
  const unitId = row.unit_id ?? row.unitId;
  if (!unitId)
    return Object.freeze({
      canConvertToDraftEnrollment: false,
      reasonCode: "CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE",
    });
  const status = row.status;
  if (stage !== "WON")
    return Object.freeze({ canConvertToDraftEnrollment: false, reasonCode: "CRM_LEAD_NOT_WON" });
  if (status !== "CONVERTED")
    return Object.freeze({
      canConvertToDraftEnrollment: false,
      reasonCode: "CRM_LEAD_NOT_CONVERTED",
    });
  if (conversionSummary(row).enrollmentCompleted) {
    return Object.freeze({
      canConvertToDraftEnrollment: false,
      reasonCode: "CRM_ENROLLMENT_ALREADY_CONVERTED",
    });
  }
  return Object.freeze({ canConvertToDraftEnrollment: true, reasonCode: null });
}

function optionalEnum(value, allowed, field) {
  if (value == null || value === "") return null;
  if (Array.isArray(value) || typeof value !== "string" || !allowed.has(value))
    throw inputError(field);
  return value;
}

function requiredId(value, field) {
  if (Array.isArray(value) || !isSafeId(value)) throw inputError(field);
  return String(value).trim();
}

function isSafeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim());
}
function iso(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}
function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function queryError(message, code, statusCode) {
  return Object.assign(new Error(message), {
    code,
    details: null,
    expose: statusCode < 500,
    statusCode,
  });
}
function inputError(field) {
  return Object.assign(new TypeError("CRM query input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}
function cursorError() {
  return Object.assign(new TypeError("CRM cursor is invalid."), {
    code: "CRM_CURSOR_INVALID",
    details: null,
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  CONVERSION_STATUSES,
  CrmLeadQueryService,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  normalizeFilters,
  resolveEligibility,
  toDetail,
  toListItem,
  toStageTimingSummary,
};
