const { logger: defaultLogger } = require("../../../observability/structured-logger.js");
const {
  normalizeFilters: normalizeHistoryFilters,
} = require("./crm-lead-conversion-history-query.service.js");

const CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS = 5000;
const CRM_CONVERSION_HISTORY_EXPORT_BATCH_SIZE = 100;
const EXPORT_SOURCE = "PERSISTED_CRM_LEAD_ENROLLMENT_CONVERSIONS";
const EXPORT_COLUMNS = Object.freeze([
  "conversionId",
  "leadId",
  "unitId",
  "personId",
  "personProfileId",
  "enrollmentId",
  "enrollmentStatus",
  "status",
  "convertedBy",
  "convertedAt",
]);
const EXPORT_FILTERS = new Set([
  "convertedBy",
  "dateFrom",
  "dateTo",
  "enrollmentStatus",
  "leadId",
  "unitId",
]);

class CrmLeadConversionHistoryExportService {
  constructor({
    repository = null,
    logger = defaultLogger,
    maxRows = CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS,
    batchSize = CRM_CONVERSION_HISTORY_EXPORT_BATCH_SIZE,
    now = () => new Date(),
    monotonicClock = defaultMonotonicClock,
  } = {}) {
    this.repository = repository;
    this.logger = logger;
    this.maxRows = positiveInteger(maxRows, CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS);
    this.batchSize = Math.min(
      positiveInteger(batchSize, CRM_CONVERSION_HISTORY_EXPORT_BATCH_SIZE),
      100,
    );
    this.now = typeof now === "function" ? now : () => new Date();
    this.monotonicClock =
      typeof monotonicClock === "function" ? monotonicClock : defaultMonotonicClock;
  }

  async export(filters = {}, context = {}) {
    const startedAt = this.monotonicClock();
    try {
      const normalized = normalizeExportFilters(filters);
      const rows = [];
      for await (const row of this.getRepository().iterateConversionHistoryForExport(normalized, {
        batchSize: this.batchSize,
        maxRows: this.maxRows + 1,
      })) {
        rows.push(row);
        if (rows.length > this.maxRows) {
          throw exportError("CRM export row limit exceeded.", "CRM_EXPORT_LIMIT_EXCEEDED", 413, {
            limit: this.maxRows,
          });
        }
      }

      const date = validDate(this.now()).toISOString().slice(0, 10);
      const result = Object.freeze({
        buffer: serializeCsv(rows),
        contentType: "text/csv; charset=utf-8",
        filename: `crm-conversions-${date}.csv`,
        rows: rows.length,
      });
      this.recordAudit("CRM_CONVERSION_HISTORY_EXPORT_SUCCEEDED", context, {
        durationMs: elapsedMilliseconds(startedAt, this.monotonicClock()),
        format: "CSV",
        recordCount: result.rows,
        result: "SUCCEEDED",
      });
      return result;
    } catch (error) {
      const safeError = isExportError(error)
        ? error
        : exportError("CRM conversion history export failed.", "CRM_EXPORT_FAILED", 500);
      this.recordAudit("CRM_CONVERSION_HISTORY_EXPORT_FAILED", context, {
        durationMs: elapsedMilliseconds(startedAt, this.monotonicClock()),
        errorCode: safeError.code,
        format: "CSV",
        result: "FAILED",
      });
      throw safeError;
    }
  }

  getRepository() {
    if (typeof this.repository?.iterateConversionHistoryForExport !== "function") {
      throw new TypeError("CRM conversion history export repository is required.");
    }
    return this.repository;
  }

  recordAudit(event, context, metadata) {
    try {
      const writer = event.endsWith("FAILED") ? this.logger?.warn : this.logger?.info;
      writer?.call(this.logger, "crm.conversion_history.export", {
        correlationId: safeText(context?.correlationId),
        durationMs: metadata.durationMs,
        errorCode: metadata.errorCode,
        event,
        format: metadata.format,
        recordCount: metadata.recordCount,
        result: metadata.result,
        source: EXPORT_SOURCE,
        userId: safeText(context?.userId),
      });
    } catch {
      // Export auditing is fail-open and must never block the download.
    }
  }
}

function normalizeExportFilters(filters = {}) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw exportError("CRM export input is invalid.", "CRM_EXPORT_INPUT_INVALID", 400);
  }
  if (filters.cursor != null || filters.limit != null || filters.fetchLimit != null) {
    throw exportError("CRM export input is invalid.", "CRM_EXPORT_INPUT_INVALID", 400);
  }
  const unknown = Object.keys(filters).filter(
    (field) => !EXPORT_FILTERS.has(field) && filters[field] != null,
  );
  if (unknown.length) {
    throw exportError("CRM export input is invalid.", "CRM_EXPORT_INPUT_INVALID", 400, {
      field: unknown[0],
    });
  }
  try {
    const normalized = normalizeHistoryFilters({ ...filters, cursor: null, limit: undefined });
    return Object.freeze({
      convertedBy: normalized.convertedBy,
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
      enrollmentStatus: normalized.enrollmentStatus,
      leadId: normalized.leadId,
      unitId: normalized.unitId,
    });
  } catch {
    throw exportError("CRM export input is invalid.", "CRM_EXPORT_INPUT_INVALID", 400);
  }
}

function serializeCsv(rows) {
  const lines = [EXPORT_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    const values = {
      conversionId: row?.id,
      convertedAt: row?.convertedAt,
      convertedBy: row?.convertedBy,
      enrollmentId: row?.enrollmentId,
      enrollmentStatus: row?.enrollmentStatus,
      leadId: row?.leadId,
      personId: row?.personId,
      personProfileId: row?.personProfileId,
      status: row?.conversionStatus,
      unitId: row?.unitId,
    };
    lines.push(EXPORT_COLUMNS.map((column) => csvCell(values[column])).join(","));
  }
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  text = text
    .replace(/\r\n/g, "\\r\\n")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${text.replace(/"/g, '""')}"`;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw exportError("CRM export clock is invalid.", "CRM_EXPORT_FAILED", 500);
  }
  return date;
}

function elapsedMilliseconds(startedAt, endedAt) {
  if (typeof startedAt === "bigint" && typeof endedAt === "bigint") {
    const duration = Number(endedAt - startedAt) / 1_000_000;
    return Number.isFinite(duration) && duration >= 0 ? Math.trunc(duration) : 0;
  }
  const duration = Number(endedAt) - Number(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? Math.trunc(duration) : 0;
}

function defaultMonotonicClock() {
  return process.hrtime.bigint();
}

function safeText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 191) : null;
}

function isExportError(error) {
  return ["CRM_EXPORT_INPUT_INVALID", "CRM_EXPORT_LIMIT_EXCEEDED", "CRM_EXPORT_FAILED"].includes(
    error?.code,
  );
}

function exportError(message, code, statusCode, details = null) {
  return Object.assign(new Error(message), {
    code,
    details,
    expose: statusCode < 500,
    statusCode,
  });
}

module.exports = {
  CRM_CONVERSION_HISTORY_EXPORT_BATCH_SIZE,
  CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS,
  EXPORT_COLUMNS,
  CrmLeadConversionHistoryExportService,
  csvCell,
  normalizeExportFilters,
  serializeCsv,
};
