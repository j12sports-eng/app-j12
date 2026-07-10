const { AutomationAuditRecord } = require("./AutomationAuditRecord.js");
const { AutomationAuditRepositoryContract } = require("./AutomationAuditRepositoryContract.js");

class InMemoryAutomationAuditRepository extends AutomationAuditRepositoryContract {
  constructor(options = {}) {
    super();
    this.records = new Map();
    this.executionIndex = new Map();
    for (const record of options.records || []) this.saveSync(record);
  }

  async save(record) {
    return this.saveSync(record);
  }

  async findByCorrelationId(correlationId) {
    return this.records.get(String(correlationId || "")) || null;
  }

  async findByExecutionId(executionId) {
    const correlationId = this.executionIndex.get(String(executionId || ""));
    return correlationId ? this.records.get(correlationId) || null : null;
  }

  async list(input = {}) {
    const values = [...this.records.values()];
    const filtered = values.filter((record) => {
      if (input.workflow && record.workflow !== input.workflow) return false;
      if (input.mode && record.mode !== input.mode) return false;
      if (typeof input.success === "boolean" && record.success !== input.success) return false;
      return true;
    });
    const limit = normalizeLimit(input.limit, 100);
    return filtered.slice(-limit).reverse();
  }

  clear() {
    this.records.clear();
    this.executionIndex.clear();
  }

  saveSync(value) {
    const record = value instanceof AutomationAuditRecord ? value : new AutomationAuditRecord(value);
    this.records.set(record.correlationId, record);
    if (record.executionId) this.executionIndex.set(record.executionId, record.correlationId);
    return record;
  }
}

function normalizeLimit(value, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : max;
}

module.exports = { InMemoryAutomationAuditRepository };
