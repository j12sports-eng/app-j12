class AutomationExecutionHistoryRepositoryContract {
  async save() {
    throw notImplemented("save");
  }
  async findById() {
    throw notImplemented("findById");
  }
  async findByExecutionId() {
    throw notImplemented("findByExecutionId");
  }
  async list() {
    throw notImplemented("list");
  }
  async count() {
    throw notImplemented("count");
  }
}

function notImplemented(method) {
  const error = new TypeError(
    `AutomationExecutionHistoryRepositoryContract must implement ${method}.`,
  );
  error.code = "AUTOMATION_HISTORY_REPOSITORY_NOT_IMPLEMENTED";
  error.details = { method };
  return error;
}

module.exports = { AutomationExecutionHistoryRepositoryContract };
