const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CURSOR_LENGTH = 256;
const CURSOR_VERSION = 1;
const ENROLLMENT_STATUSES = new Set(["DRAFT"]);

/** Queries the persisted, completed CRM conversion history without exposing PII. */
class CrmLeadConversionHistoryQueryService {
  constructor({ repository = null } = {}) {
    this.repository = repository;
  }

  async listConversions(filters = {}) {
    const normalized = normalizeFilters(filters);
    const cursor = normalized.cursor ? decodeCursor(normalized.cursor) : null;
    let records;
    try {
      records = await this.getRepository().listConversionHistory({
        ...normalized,
        cursor,
        fetchLimit: normalized.limit + 1,
      });
    } catch {
      throw historyError(
        "CRM conversion history query failed.",
        "CRM_CONVERSION_HISTORY_FAILED",
        500,
      );
    }

    const safeRecords = Array.isArray(records) ? records : [];
    const hasNextPage = safeRecords.length > normalized.limit;
    const items = safeRecords.slice(0, normalized.limit).map(toHistoryItem);
    const last = items.at(-1);
    return Object.freeze({
      items,
      pageInfo: Object.freeze({
        hasNextPage,
        nextCursor:
          hasNextPage && last ? encodeCursor({ convertedAt: last.convertedAt, id: last.id }) : null,
      }),
    });
  }

  async getConversionById(conversionId) {
    const id = requiredId(conversionId, "conversionId");
    let record;
    try {
      record = await this.getRepository().findConversionHistoryById(id);
    } catch {
      throw historyError(
        "CRM conversion history query failed.",
        "CRM_CONVERSION_HISTORY_FAILED",
        500,
      );
    }
    if (!record) {
      throw historyError(
        "CRM conversion history entry not found.",
        "CRM_CONVERSION_HISTORY_NOT_FOUND",
        404,
      );
    }
    return toHistoryDetail(record);
  }

  getRepository() {
    if (
      typeof this.repository?.listConversionHistory !== "function" ||
      typeof this.repository?.findConversionHistoryById !== "function"
    ) {
      throw new TypeError("CRM conversion history repository is required.");
    }
    return this.repository;
  }
}

function normalizeFilters(filters = {}) {
  const limit = parseLimit(filters.limit);
  const cursor = filters.cursor == null ? null : parseCursor(filters.cursor);
  const leadId = optionalId(filters.leadId, "leadId");
  const unitId = optionalId(filters.unitId, "unitId");
  const convertedBy = optionalActor(filters.convertedBy);
  const enrollmentStatus = optionalEnum(
    filters.enrollmentStatus,
    ENROLLMENT_STATUSES,
    "enrollmentStatus",
  );
  const dateFrom = optionalDate(filters.dateFrom, "dateFrom", false);
  const dateTo = optionalDate(filters.dateTo, "dateTo", true);
  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
    throw inputError("dateTo");
  }
  return Object.freeze({
    convertedBy,
    cursor,
    dateFrom,
    dateTo,
    enrollmentStatus,
    leadId,
    limit,
    unitId,
  });
}

function toHistoryItem(record) {
  return Object.freeze({
    conversionStatus: record.conversionStatus === "COMPLETED" ? "COMPLETED" : null,
    convertedAt: iso(record.convertedAt),
    convertedBy: nullableText(record.convertedBy),
    correlationId: null,
    enrollmentId: nullableId(record.enrollmentId),
    enrollmentStatus: record.enrollmentStatus === "DRAFT" ? "DRAFT" : null,
    id: nullableId(record.id),
    leadId: nullableId(record.leadId),
    personId: nullableId(record.personId),
    personProfileId: nullableId(record.personProfileId),
    resolutions: unavailableResolutions(),
    reused: unavailableReused(),
    unitId: nullableId(record.unitId),
  });
}

function toHistoryDetail(record) {
  return Object.freeze({
    ...toHistoryItem(record),
    source: "crm_lead_enrollment_conversions",
    version: null,
  });
}

function unavailableResolutions() {
  return Object.freeze({ enrollment: null, person: null, profile: null });
}

function unavailableReused() {
  return Object.freeze({ enrollment: null, person: null, profile: null });
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
    !isValidDateTime(decoded.convertedAt) ||
    !isSafeId(decoded.id)
  ) {
    throw cursorError();
  }
  return Object.freeze({
    convertedAt: new Date(decoded.convertedAt).toISOString(),
    id: decoded.id,
  });
}

function encodeCursor({ convertedAt, id }) {
  return Buffer.from(
    JSON.stringify({ convertedAt: new Date(convertedAt).toISOString(), id, v: CURSOR_VERSION }),
    "utf8",
  ).toString("base64url");
}

function optionalId(value, field) {
  if (value == null || value === "") return null;
  return requiredId(value, field);
}

function requiredId(value, field) {
  if (Array.isArray(value) || !isSafeId(value)) throw inputError(field);
  return String(value).trim();
}

function optionalActor(value) {
  if (value == null || value === "") return null;
  if (
    Array.isArray(value) ||
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9@._:+-]{0,190}$/.test(value.trim())
  ) {
    throw inputError("convertedBy");
  }
  return value.trim();
}

function optionalEnum(value, allowed, field) {
  if (value == null || value === "") return null;
  if (Array.isArray(value) || typeof value !== "string" || !allowed.has(value)) {
    throw inputError(field);
  }
  return value;
}

function optionalDate(value, field, endOfDay) {
  if (value == null || value === "") return null;
  if (Array.isArray(value) || typeof value !== "string" || value.length > 40) {
    throw inputError(field);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const normalized = `${value}${suffix}`;
    if (new Date(normalized).toISOString().slice(0, 10) !== value) throw inputError(field);
    return normalized;
  }
  if (!isValidDateTime(value)) throw inputError(field);
  return new Date(value).toISOString();
}

function nullableId(value) {
  return isSafeId(value) ? String(value).trim() : null;
}

function nullableText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 191) : null;
}

function isSafeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim());
}

function isValidDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  if (!isValidDateTime(value)) return null;
  return new Date(value).toISOString();
}

function historyError(message, code, statusCode) {
  return Object.assign(new Error(message), {
    code,
    details: null,
    expose: statusCode < 500,
    statusCode,
  });
}

function inputError(field) {
  return Object.assign(new TypeError("CRM conversion history input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

function cursorError() {
  return Object.assign(new TypeError("CRM conversion history cursor is invalid."), {
    code: "CRM_CURSOR_INVALID",
    details: null,
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  CrmLeadConversionHistoryQueryService,
  DEFAULT_LIMIT,
  ENROLLMENT_STATUSES,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  normalizeFilters,
  toHistoryDetail,
  toHistoryItem,
};
