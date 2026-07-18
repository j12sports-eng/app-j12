const ALLOWED_QUERY_FIELDS = new Set([
  "conversionStatus",
  "cursor",
  "limit",
  "stage",
  "status",
  "unitId",
]);

class CrmLeadQueryController {
  constructor({ queryService = null } = {}) {
    this.queryService = queryService;
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
  }

  async list(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().listLeads(readFilters(req.query)),
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const leadId = readId(req.params?.leadId, "leadId");
      const unitId = readDetailUnitFilter(req.query);
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().getLeadById({ leadId, unitId }),
      });
    } catch (error) {
      return next(error);
    }
  }

  getQueryService() {
    if (
      typeof this.queryService?.listLeads !== "function" ||
      typeof this.queryService?.getLeadById !== "function"
    ) {
      throw new TypeError("CrmLeadQueryController requires queryService.");
    }
    return this.queryService;
  }
}

function readFilters(query = {}) {
  assertPlainObject(query);
  const unknown = Object.keys(query).filter((key) => !ALLOWED_QUERY_FIELDS.has(key));
  if (unknown.length) throw inputError(unknown[0]);
  return {
    conversionStatus: readSingle(query.conversionStatus, "conversionStatus"),
    cursor: readSingle(query.cursor, "cursor"),
    limit: readSingle(query.limit, "limit"),
    stage: readSingle(query.stage, "stage"),
    status: readSingle(query.status, "status"),
    unitId: query.unitId == null ? null : readId(query.unitId, "unitId"),
  };
}

function readDetailUnitFilter(query = {}) {
  assertPlainObject(query);
  const unknown = Object.keys(query).filter((key) => key !== "unitId");
  if (unknown.length) throw inputError(unknown[0]);
  return query.unitId == null ? null : readId(query.unitId, "unitId");
}

function readSingle(value, field) {
  if (value == null) return null;
  if (Array.isArray(value) || typeof value !== "string" || value.length > 256)
    throw inputError(field);
  return value;
}

function readId(value, field) {
  if (
    Array.isArray(value) ||
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim())
  )
    throw inputError(field);
  return value.trim();
}

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("query");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw inputError("query");
}

function inputError(field) {
  return Object.assign(new TypeError("CRM query input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

module.exports = { ALLOWED_QUERY_FIELDS, CrmLeadQueryController, readFilters };
