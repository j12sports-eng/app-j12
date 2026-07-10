class AutomationAuditRepositoryContract {
  async save() {
    throw notImplemented("save");
  }
  async findByCorrelationId() {
    throw notImplemented("findByCorrelationId");
  }
  async findByExecutionId() {
    throw notImplemented("findByExecutionId");
  }
  async list() {
    throw notImplemented("list");
  }
}

function notImplemented(method) {
  const error = new TypeError(`AutomationAuditRepositoryContract must implement ${method}.`);
  error.code = "AUTOMATION_AUDIT_REPOSITORY_NOT_IMPLEMENTED";
  error.details = { method };
  return error;
}

module.exports = { AutomationAuditRepositoryContract };
