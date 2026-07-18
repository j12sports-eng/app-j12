const ALLOWED_QUERY_FIELDS = new Set([
  "convertedBy",
  "cursor",
  "dateFrom",
  "dateTo",
  "enrollmentStatus",
  "leadId",
  "limit",
  "unitId",
]);

class CrmLeadConversionHistoryController {
  constructor({ queryService = null } = {}) {
    this.queryService = queryService;
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
  }

  async list(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().listConversions(readFilters(req.query)),
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const conversionId = readId(req.params?.conversionId, "conversionId");
      assertEmptyQuery(req.query);
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().getConversionById(conversionId),
      });
    } catch (error) {
      return next(error);
    }
  }

  getQueryService() {
    if (
      typeof this.queryService?.listConversions !== "function" ||
      typeof this.queryService?.getConversionById !== "function"
    ) {
      throw new TypeError("CrmLeadConversionHistoryController requires queryService.");
    }
    return this.queryService;
  }
}

function readFilters(query = {}) {
  assertPlainObject(query);
  const unknown = Object.keys(query).filter((key) => !ALLOWED_QUERY_FIELDS.has(key));
  if (unknown.length) throw inputError(unknown[0]);
  return {
    convertedBy: readSingle(query.convertedBy, "convertedBy"),
    cursor: readSingle(query.cursor, "cursor"),
    dateFrom: readSingle(query.dateFrom, "dateFrom"),
    dateTo: readSingle(query.dateTo, "dateTo"),
    enrollmentStatus: readSingle(query.enrollmentStatus, "enrollmentStatus"),
    leadId: query.leadId == null ? null : readId(query.leadId, "leadId"),
    limit: readSingle(query.limit, "limit"),
    unitId: query.unitId == null ? null : readId(query.unitId, "unitId"),
  };
}

function assertEmptyQuery(query = {}) {
  assertPlainObject(query);
  const first = Object.keys(query)[0];
  if (first) throw inputError(first);
}

function readSingle(value, field) {
  if (value == null) return null;
  if (Array.isArray(value) || typeof value !== "string" || value.length > 256) {
    throw inputError(field);
  }
  return value;
}

function readId(value, field) {
  if (
    Array.isArray(value) ||
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim())
  ) {
    throw inputError(field);
  }
  return value.trim();
}

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("query");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw inputError("query");
}

function inputError(field) {
  return Object.assign(new TypeError("CRM conversion history input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  ALLOWED_QUERY_FIELDS,
  CrmLeadConversionHistoryController,
  readFilters,
};
