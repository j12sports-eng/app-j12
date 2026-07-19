const ALLOWED_QUERY_FIELDS = new Set(["cursor", "limit", "slaStatus", "stage", "unitId"]);

class CrmLeadSlaAlertController {
  constructor({ queryService = null } = {}) {
    this.queryService = queryService;
    this.list = this.list.bind(this);
  }

  async list(req, res, next) {
    try {
      const user = req.auth || req.user || {};
      return res.status(200).json({
        success: true,
        data: await this.getQueryService().listSlaAlerts(readFilters(req.query), {
          correlationId: req.correlationId || req.id || null,
          userId: user.id || user.userId || user.sub || null,
        }),
      });
    } catch (error) {
      return next(error);
    }
  }

  getQueryService() {
    if (typeof this.queryService?.listSlaAlerts !== "function") {
      throw new TypeError("CrmLeadSlaAlertController requires queryService.");
    }
    return this.queryService;
  }
}

function readFilters(query = {}) {
  assertPlainObject(query);
  const unknown = Object.keys(query).filter((key) => !ALLOWED_QUERY_FIELDS.has(key));
  if (unknown.length) throw inputError(unknown[0]);
  return {
    cursor: readSingle(query.cursor, "cursor", 1024),
    limit: readSingle(query.limit, "limit", 16),
    slaStatus: readSingle(query.slaStatus, "slaStatus", 64),
    stage: readSingle(query.stage, "stage", 64),
    unitId: query.unitId == null ? null : readId(query.unitId, "unitId"),
  };
}

function readSingle(value, field, maxLength) {
  if (value == null) return null;
  if (
    Array.isArray(value) ||
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maxLength
  ) {
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
  return Object.assign(new TypeError("CRM SLA alert input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  ALLOWED_QUERY_FIELDS,
  CrmLeadSlaAlertController,
  readFilters,
};
