const { logger: defaultLogger } = require("./structured-logger.js");

async function observeAsyncOperation(name, operation, metadata = {}, logger = defaultLogger) {
  const startedAt = Date.now();
  logger.info("async.operation.started", { operation: name, ...metadata });
  try {
    const result = await operation();
    logger.info("async.operation.completed", {
      operation: name,
      durationMs: Date.now() - startedAt,
      ...metadata,
    });
    return result;
  } catch (error) {
    logger.error("async.operation.failed", {
      operation: name,
      durationMs: Date.now() - startedAt,
      error,
      ...metadata,
    });
    throw error;
  }
}

module.exports = { observeAsyncOperation };
