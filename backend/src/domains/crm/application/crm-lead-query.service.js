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

class CrmLeadQueryService {
  constructor({ repository = null } = {}) {
    this.repository = repository;
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
    const items = safeRows.slice(0, normalized.limit).map(toListItem);
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
    return toDetail(row);
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

function toListItem(row) {
  const eligibility = resolveEligibility(row);
  return Object.freeze({
    createdAt: iso(row.created_at ?? row.createdAt),
    eligibility,
    id: row.id,
    stage: row.stage,
    status: row.status,
    unitId: row.unit_id ?? row.unitId,
    updatedAt: iso(row.updated_at ?? row.updatedAt),
    conversions: conversionSummary(row),
  });
}

function toDetail(row) {
  const item = toListItem(row);
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
};
