const {
  AutomationExecutionHistoryRecord,
  AutomationExecutionHistoryRepositoryContract,
  normalizeHistoryFilters,
} = require("../../application/history/index.js");

const TABLE_NAME = "financial_automation_execution_history";

const INSERT_HISTORY_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id, execution_id, automation_name, workflow_name, trigger_type, status,
    started_at, finished_at, duration_ms, attempt, correlation_id,
    input_json, output_json, error_json, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_BY_ID_SQL = `
  SELECT * FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_BY_EXECUTION_ID_SQL = `
  SELECT * FROM ${TABLE_NAME}
  WHERE execution_id = ?
  ORDER BY started_at DESC, created_at DESC, id DESC
  LIMIT 1
`;

class MySqlAutomationExecutionHistoryRepository extends AutomationExecutionHistoryRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async save(value) {
    const record =
      value instanceof AutomationExecutionHistoryRecord
        ? value
        : new AutomationExecutionHistoryRecord(value);
    const data = toPersistence(record);
    await this.query(INSERT_HISTORY_SQL, [
      data.id,
      data.execution_id,
      data.automation_name,
      data.workflow_name,
      data.trigger_type,
      data.status,
      data.started_at,
      data.finished_at,
      data.duration_ms,
      data.attempt,
      data.correlation_id,
      data.input_json,
      data.output_json,
      data.error_json,
      data.metadata_json,
      data.created_at,
    ]);
    return record;
  }

  async findById(id) {
    const rows = await this.query(SELECT_BY_ID_SQL, [requiredLookup(id, "id", 64)]);
    return toDomain(readRows(rows)[0] || null);
  }

  async findByExecutionId(executionId) {
    const rows = await this.query(SELECT_BY_EXECUTION_ID_SQL, [
      requiredLookup(executionId, "executionId", 191),
    ]);
    return toDomain(readRows(rows)[0] || null);
  }

  async list(input = {}) {
    const filters = normalizeHistoryFilters(input);
    const where = [];
    const params = [];
    addFilter(where, params, "automation_name", filters.automationName);
    addFilter(where, params, "workflow_name", filters.workflowName);
    addFilter(where, params, "status", filters.status);
    addFilter(where, params, "correlation_id", filters.correlationId);
    addFilter(where, params, "execution_id", filters.executionId);
    addFilter(where, params, "started_at", filters.startedFrom, ">=");
    addFilter(where, params, "started_at", filters.startedTo, "<=");
    const sql = `
      SELECT * FROM ${TABLE_NAME}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY started_at DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    params.push(filters.limit, filters.offset);
    const rows = await this.query(sql, params);
    return readRows(rows).map(toDomain);
  }
}

function toPersistence(record) {
  return {
    attempt: record.attempt,
    automation_name: record.automationName,
    correlation_id: record.correlationId,
    created_at: toMysqlDate(record.createdAt),
    duration_ms: record.durationMs,
    error_json: safeStringify(record.error),
    execution_id: record.executionId,
    finished_at: toMysqlDate(record.finishedAt),
    id: record.id,
    input_json: safeStringify(record.input),
    metadata_json: safeStringify(record.metadata),
    output_json: safeStringify(record.output),
    started_at: toMysqlDate(record.startedAt),
    status: record.status,
    trigger_type: record.triggerType,
    workflow_name: record.workflowName,
  };
}

function toDomain(row) {
  if (!row) return null;
  return new AutomationExecutionHistoryRecord({
    attempt: row.attempt,
    automationName: row.automation_name,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    error: parseJsonColumn(row.error_json, "error_json"),
    executionId: row.execution_id,
    finishedAt: row.finished_at,
    id: row.id,
    input: parseJsonColumn(row.input_json, "input_json"),
    metadata: parseJsonColumn(row.metadata_json, "metadata_json"),
    output: parseJsonColumn(row.output_json, "output_json"),
    startedAt: row.started_at,
    status: row.status,
    triggerType: row.trigger_type,
    workflowName: row.workflow_name,
  });
}

function safeStringify(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    const error = new TypeError("Automation history contains non-serializable data.");
    error.code = "AUTOMATION_HISTORY_SERIALIZATION_FAILED";
    throw error;
  }
}

function parseJsonColumn(value, column) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    const error = new Error(`Automation history contains invalid JSON in ${column}.`);
    error.code = "AUTOMATION_HISTORY_DATA_INVALID";
    error.details = { column };
    throw error;
  }
}

function toMysqlDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function addFilter(where, params, column, value, operator = "=") {
  if (value === null || value === undefined) return;
  where.push(`${column} ${operator} ?`);
  params.push(value);
}

function requiredLookup(value, field, max) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) {
    const error = new TypeError(`Automation history requires valid ${field}.`);
    error.code = "AUTOMATION_HISTORY_LOOKUP_INVALID";
    error.details = { field };
    throw error;
  }
  return text;
}

function readRows(result) {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function getDefaultQueryRunner() {
  return async (sql, params = []) => {
    const { query } = require("../../../../config/db.js");
    return query(sql, params);
  };
}

module.exports = {
  INSERT_HISTORY_SQL,
  MySqlAutomationExecutionHistoryRepository,
  SELECT_BY_EXECUTION_ID_SQL,
  SELECT_BY_ID_SQL,
  TABLE_NAME,
  parseJsonColumn,
  safeStringify,
  toDomain,
  toPersistence,
};
