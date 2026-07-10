const {
  AutomationExecutionHistoryRecord,
  AutomationExecutionHistoryStatus,
} = require("./AutomationExecutionHistoryRecord.js");
const {
  AutomationExecutionHistoryRepositoryContract,
} = require("./AutomationExecutionHistoryRepositoryContract.js");

const MAX_HISTORY_LIST_LIMIT = 1000;

class InMemoryAutomationExecutionHistoryRepository extends AutomationExecutionHistoryRepositoryContract {
  constructor(options = {}) {
    super();
    this.records = new Map();
    for (const record of options.records || []) this.saveSync(record);
  }

  async save(record) {
    return this.saveSync(record);
  }
  async findById(id) {
    return cloneRecord(this.records.get(requiredText(id, "id")) || null);
  }

  async findByExecutionId(executionId) {
    const records = await this.list({
      executionId: requiredText(executionId, "executionId"),
      limit: 1,
    });
    return records[0] || null;
  }

  async list(input = {}) {
    const filters = normalizeHistoryFilters(input);
    return [...this.records.values()]
      .filter((record) => matches(record, filters))
      .sort((left, right) => compareRecords(left, right, filters))
      .slice(filters.offset, filters.offset + filters.limit)
      .map(cloneRecord);
  }

  async count(input = {}) {
    const filters = normalizeHistoryFilters({ ...input, limit: 1, offset: 0 });
    return [...this.records.values()].filter((record) => matches(record, filters)).length;
  }

  clear() {
    this.records.clear();
  }

  saveSync(value) {
    const record =
      value instanceof AutomationExecutionHistoryRecord
        ? new AutomationExecutionHistoryRecord(value.toJSON())
        : new AutomationExecutionHistoryRecord(value);
    this.records.set(record.id, record);
    return cloneRecord(record);
  }
}

function normalizeHistoryFilters(input = {}) {
  return {
    automationName: optionalText(input.automationName),
    correlationId: optionalText(input.correlationId),
    executionId: optionalText(input.executionId),
    limit: normalizeLimit(input.limit),
    offset: normalizeOffset(input.offset),
    startedFrom: optionalTimestamp(input.startedFrom, "startedFrom"),
    startedTo: optionalTimestamp(input.startedTo, "startedTo"),
    status: normalizeStatusFilter(input.status),
    sortBy: normalizeSortBy(input.sortBy),
    sortDirection: normalizeSortDirection(input.sortDirection),
    triggerType: optionalText(input.triggerType),
    workflowName: optionalText(input.workflowName),
  };
}

function matches(record, filters) {
  if (filters.automationName && record.automationName !== filters.automationName) return false;
  if (filters.workflowName && record.workflowName !== filters.workflowName) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.correlationId && record.correlationId !== filters.correlationId) return false;
  if (filters.executionId && record.executionId !== filters.executionId) return false;
  if (filters.triggerType && record.triggerType !== filters.triggerType) return false;
  if (filters.startedFrom && record.startedAt < filters.startedFrom) return false;
  if (filters.startedTo && record.startedAt > filters.startedTo) return false;
  return true;
}

function compareRecords(left, right, filters) {
  const comparison = compareNullable(left[filters.sortBy], right[filters.sortBy]);
  return (
    (filters.sortDirection === "asc" ? comparison : -comparison) || right.id.localeCompare(left.id)
  );
}

function compareNullable(left, right) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  return typeof left === "number" ? left - right : String(left).localeCompare(String(right));
}

function cloneRecord(record) {
  return record ? new AutomationExecutionHistoryRecord(record.toJSON()) : null;
}

function normalizeLimit(value) {
  if (value === undefined || value === null) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_HISTORY_LIST_LIMIT)
    throw invalidFilter("limit");
  return parsed;
}

function normalizeOffset(value) {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw invalidFilter("offset");
  return parsed;
}

function optionalTimestamp(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalidFilter(field);
  return parsed.toISOString();
}

function requiredText(value, field) {
  const text = optionalText(value);
  if (!text) throw invalidFilter(field);
  return text;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function normalizeStatusFilter(value) {
  const status = optionalText(value)?.toUpperCase() || null;
  if (status && !Object.values(AutomationExecutionHistoryStatus).includes(status))
    throw invalidFilter("status");
  return status;
}
function normalizeSortBy(value) {
  const field = optionalText(value) || "startedAt";
  if (!["startedAt", "finishedAt", "durationMs"].includes(field)) throw invalidFilter("sortBy");
  return field;
}
function normalizeSortDirection(value) {
  const direction = (optionalText(value) || "desc").toLowerCase();
  if (!["asc", "desc"].includes(direction)) throw invalidFilter("sortDirection");
  return direction;
}
function invalidFilter(field) {
  return Object.assign(new TypeError(`Automation history filter ${field} is invalid.`), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
    details: { field },
  });
}

module.exports = {
  InMemoryAutomationExecutionHistoryRepository,
  MAX_HISTORY_LIST_LIMIT,
  normalizeHistoryFilters,
};
