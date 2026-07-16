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
    error,
    statusCode: Number(error?.statusCode || error?.status || 500),
    user: authenticatedUserContext(req?.user),
    ...metadata,
  });
}

function requestMetadata(req = {}) {
  return {
    correlationId: req.correlationId || null,
    method: req.method || null,
    path: req.originalUrl || req.url || "/",
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

module.exports = {
  authenticatedUserContext,
  createRequestObservabilityMiddleware,
  logHttpError,
  readId,
};
