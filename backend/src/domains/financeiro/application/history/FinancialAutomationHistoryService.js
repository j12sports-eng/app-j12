const { randomUUID } = require("node:crypto");

const {
  AutomationExecutionHistoryRecord,
  AutomationExecutionHistoryStatus,
} = require("./AutomationExecutionHistoryRecord.js");

class FinancialAutomationHistoryService {
  constructor(options = {}) {
    this.repository = options.repository || options.historyRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
    this.createId =
      typeof options.createId === "function" ? options.createId : () => `fah-${randomUUID()}`;
  }

  recordStarted(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.STARTED);
  }
  recordSucceeded(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.SUCCEEDED);
  }
  recordFailed(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.FAILED);
  }
  recordWarning(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.WARNING);
  }
  recordTimedOut(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.TIMED_OUT);
  }
  recordCancelled(data = {}) {
    return this.record(data, AutomationExecutionHistoryStatus.CANCELLED);
  }

  async record(data, status) {
    const now = this.timestamp();
    const startedAt = data.startedAt;
    const finishedAt =
      data.finishedAt ?? (status === AutomationExecutionHistoryStatus.STARTED ? null : now);
    const durationMs = data.durationMs ?? calculateDuration(startedAt, finishedAt);
    const record = new AutomationExecutionHistoryRecord({
      ...data,
      createdAt: data.createdAt ?? now,
      durationMs,
      finishedAt,
      id: data.id ?? this.createId(),
      status,
    });
    return this.repositoryMethod("save")(record);
  }

  async findByExecutionId(executionId) {
    return this.repositoryMethod("findByExecutionId")(executionId);
  }

  async listHistory(filters = {}) {
    return this.repositoryMethod("list")(filters);
  }

  repositoryMethod(method) {
    const implementation = this.repository?.[method];
    if (typeof implementation !== "function") {
      const error = new TypeError(
        `FinancialAutomationHistoryService requires repository.${method}.`,
      );
      error.code = "AUTOMATION_HISTORY_REPOSITORY_INVALID";
      error.details = { method };
      throw error;
    }
    return implementation.bind(this.repository);
  }

  timestamp() {
    const value = this.now();
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const error = new TypeError("Automation history clock returned an invalid timestamp.");
      error.code = "AUTOMATION_HISTORY_CLOCK_INVALID";
      throw error;
    }
    return parsed.toISOString();
  }
}

function calculateDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

module.exports = { FinancialAutomationHistoryService };
