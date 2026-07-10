const {
  FinancialAutomationHistoryService,
  sanitizeAutomationHistoryJson,
} = require("../../application/history");

class FinancialAutomationHistoryController {
  constructor(options = {}) {
    this.historyService =
      options.historyService ||
      options.financialAutomationHistoryService ||
      new FinancialAutomationHistoryService(options);

    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.getByExecutionId = this.getByExecutionId.bind(this);
  }

  async list(req, res) {
    try {
      const { filters, limit, page } = parseListQuery(req.query);
      const [items, total] = await Promise.all([
        this.historyService.listHistory({ ...filters, limit, offset: (page - 1) * limit }),
        this.historyService.countHistory(filters),
      ]);
      return res.json({
        success: true,
        data: {
          items: items.map(toSafeJson),
          pagination: {
            page,
            limit,
            total,
            hasNext: page * limit < total,
            hasPrevious: page > 1,
          },
        },
      });
    } catch (error) {
      return respondError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const record = await this.historyService.findById(
        requiredParam(req.params?.historyId, "historyId"),
      );
      if (!record) return notFound(res, "AUTOMATION_HISTORY_NOT_FOUND");
      return res.json({ success: true, data: toSafeJson(record) });
    } catch (error) {
      return respondError(res, error);
    }
  }

  async getByExecutionId(req, res) {
    try {
      const executionId = requiredParam(req.params?.executionId, "executionId");
      const items = await this.historyService.listByExecutionId(executionId, {
        limit: 1000,
        sortBy: "startedAt",
        sortDirection: "asc",
      });
      if (!items.length) return notFound(res, "AUTOMATION_EXECUTION_HISTORY_NOT_FOUND");
      return res.json({ success: true, data: { executionId, items: items.map(toSafeJson) } });
    } catch (error) {
      return respondError(res, error);
    }
  }
}

function parseListQuery(query = {}) {
  const page = positiveInteger(query.page ?? 1, "page");
  const limit = positiveInteger(query.limit ?? 50, "limit");
  if (limit > 1000) throw invalidInput("limit");
  return {
    page,
    limit,
    filters: {
      automationName: query.automationName,
      correlationId: query.correlationId,
      executionId: query.executionId,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
      status: query.status,
      triggerType: query.triggerType,
      workflowName: query.workflowName,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    },
  };
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw invalidInput(field);
  return parsed;
}

function requiredParam(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw invalidInput(field);
  return text;
}

function invalidInput(field) {
  return Object.assign(new TypeError("Consulta de historico invalida."), {
    code: "AUTOMATION_HISTORY_INPUT_INVALID",
    details: { field },
  });
}

function toSafeJson(record) {
  return sanitizeAutomationHistoryJson(
    typeof record?.toJSON === "function" ? record.toJSON() : record,
  );
}

function notFound(res, code) {
  return res.status(404).json({ success: false, error: "Historico nao encontrado.", code });
}

function respondError(res, error) {
  const clientCodes = new Set([
    "AUTOMATION_HISTORY_FILTER_INVALID",
    "AUTOMATION_HISTORY_INPUT_INVALID",
    "AUTOMATION_HISTORY_LOOKUP_INVALID",
    "AUTOMATION_HISTORY_RECORD_INVALID",
  ]);
  const status = clientCodes.has(error?.code) ? 400 : 500;
  const code = status === 400 ? error.code : "AUTOMATION_HISTORY_QUERY_FAILED";
  return res.status(status).json({
    success: false,
    error:
      status === 400
        ? "Consulta de historico invalida."
        : "Nao foi possivel consultar o historico.",
    code,
    ...(status === 400 && error?.details ? { details: error.details } : {}),
  });
}

module.exports = {
  FinancialAutomationHistoryController,
  parseListQuery,
  respondError,
};
