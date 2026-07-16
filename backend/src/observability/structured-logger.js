const { getObservabilityContext } = require("./context.js");

const LEVELS = Object.freeze({ ERROR: "ERROR", INFO: "INFO", WARN: "WARN" });
const REDACTED_KEYS = /authorization|cookie|password|secret|token|private.?key|certificate/i;

function createStructuredLogger(options = {}) {
  const consoleTarget = options.consoleTarget || console;
  const clock = options.clock || (() => new Date());

  function write(level, event, metadata = {}) {
    const context = getObservabilityContext();
    const entry = sanitize({
      ...(typeof event === "object" && event ? event : {}),
      ...(metadata || {}),
      timestamp: clock().toISOString(),
      level,
      event: typeof event === "string" ? event : event?.event || "application.event",
      correlationId: context.correlationId || null,
      requestId: context.requestId || null,
    });
    const line = JSON.stringify(entry);
    const method = level === LEVELS.ERROR ? "error" : level === LEVELS.WARN ? "warn" : "log";
    consoleTarget[method]?.(line);
    return entry;
  }

  return {
    error: (event, metadata) => write(LEVELS.ERROR, event, metadata),
    info: (event, metadata) => write(LEVELS.INFO, event, metadata),
    warn: (event, metadata) => write(LEVELS.WARN, event, metadata),
  };
}

function sanitize(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { code: value.code || null, message: value.message, name: value.name };
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.test(key) ? "[REDACTED]" : sanitize(item, seen);
  }
  return result;
}

const logger = createStructuredLogger();

module.exports = { LEVELS, createStructuredLogger, logger, sanitize };
