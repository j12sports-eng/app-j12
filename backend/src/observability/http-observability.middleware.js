const { randomUUID } = require("node:crypto");

const { runWithObservabilityContext } = require("./context.js");
const { logger: defaultLogger } = require("./structured-logger.js");

function createRequestObservabilityMiddleware(options = {}) {
  const logger = options.logger || defaultLogger;
  const now = options.now || (() => Date.now());
  const createId = options.createId || randomUUID;

  return function requestObservability(req, res, next) {
    const requestId = readId(req.headers?.["x-request-id"]) || createId();
    const correlationId = readId(req.headers?.["x-correlation-id"]) || requestId;
    const startedAt = now();
    req.id = requestId;
    req.correlationId = correlationId;
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Correlation-Id", correlationId);

    return runWithObservabilityContext({ correlationId, requestId }, () => {
      logger.info("http.request.started", requestMetadata(req));
      res.once("finish", () => {
        const metadata = {
          ...requestMetadata(req),
          durationMs: Math.max(0, now() - startedAt),
          statusCode: res.statusCode,
          user: authenticatedUserContext(req.user),
        };
        if (res.statusCode >= 500) logger.error("http.request.completed", metadata);
        else if (res.statusCode >= 400) logger.warn("http.request.completed", metadata);
        else logger.info("http.request.completed", metadata);
      });
      next();
    });
  };
}

function logHttpError(error, req, metadata = {}, logger = defaultLogger) {
  return logger.error("http.request.failed", {
    ...requestMetadata(req),
    code: error?.code || error?.errorCode || "INTERNAL_ERROR",
    error: sanitizeSensitiveError(error),
    statusCode: Number(error?.statusCode || error?.status || 500),
    user: authenticatedUserContext(req?.user),
    ...sanitizeSensitiveMetadata(metadata),
  });
}

function requestMetadata(req = {}) {
  return {
    correlationId: req.correlationId || null,
    method: req.method || null,
    path: sanitizeSensitivePath(req.originalUrl || req.url || "/"),
    requestId: req.id || null,
  };
}

function authenticatedUserContext(user) {
  if (!user || typeof user !== "object") return null;
  return {
    id: user.id || user.userId || user.sub || null,
    role: user.role || user.perfil || null,
  };
}

function readId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized && normalized.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(normalized)
    ? normalized
    : null;
}

const SENSITIVE_PATH_PATTERN =
  /((?:\/api)?\/enrollments\/digital-invitations\/public)\/[^/?#\s]+/gi;

function sanitizeSensitivePath(value) {
  return String(value ?? "").replace(SENSITIVE_PATH_PATTERN, "$1/[REDACTED]");
}

function sanitizeSensitiveMetadata(value, seen = new WeakSet()) {
  if (typeof value === "string") return sanitizeSensitivePath(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeSensitiveMetadata(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /^(?:raw)?token(?:hash)?$/i.test(key)
        ? "[REDACTED]"
        : sanitizeSensitiveMetadata(item, seen),
    ]),
  );
}

function sanitizeSensitiveError(error) {
  if (!error || typeof error !== "object") return sanitizeSensitiveMetadata(error);
  return {
    code: error.code || error.errorCode || null,
    message: sanitizeSensitivePath(error.message || "Request failed"),
    name: error.name || "Error",
  };
}

module.exports = {
  authenticatedUserContext,
  createRequestObservabilityMiddleware,
  logHttpError,
  readId,
  sanitizeSensitiveMetadata,
  sanitizeSensitivePath,
};
