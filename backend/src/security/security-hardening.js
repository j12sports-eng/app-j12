const { createHash } = require("node:crypto");
const { logger: defaultLogger } = require("../observability/structured-logger.js");

const SECURITY_EVENTS = Object.freeze({
  ACCESS_DENIED: "ACCESS_DENIED",
  BRUTE_FORCE_TRIGGERED: "BRUTE_FORCE_TRIGGERED",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  RATE_LIMIT_TRIGGERED: "RATE_LIMIT_TRIGGERED",
  SECURITY_CONFIGURATION: "SECURITY_CONFIGURATION",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  VALIDATION_FAILED: "VALIDATION_FAILED",
});

function securityMetadata(req, metadata = {}) {
  return {
    method: req?.method || null,
    path: req?.route?.path || req?.path || null,
    user: req?.user ? { id: req.user.id || null, role: req.user.role || null } : undefined,
    ...metadata,
  };
}

function logSecurityEvent(event, req, metadata = {}, logger = defaultLogger) {
  const level =
    event === SECURITY_EVENTS.LOGIN_SUCCESS || event === SECURITY_EVENTS.SECURITY_CONFIGURATION
      ? "info"
      : "warn";
  return logger[level](
    "security.event",
    securityMetadata(req, { securityEvent: event, ...metadata }),
  );
}

function createSecurityHeadersMiddleware(options = {}) {
  const logger = options.logger || defaultLogger;
  const production = options.production ?? process.env.NODE_ENV === "production";
  logSecurityEvent(
    SECURITY_EVENTS.SECURITY_CONFIGURATION,
    null,
    { component: "http_headers", cspEnabled: true, hstsEnabled: production },
    logger,
  );
  return function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    if (production) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (isSensitiveRequest(req)) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
    }
    next();
  };
}

function createSlidingWindowRateLimiter(options = {}) {
  const store = options.store || new Map();
  const logger = options.logger || defaultLogger;
  const now = options.now || Date.now;
  const policies = options.policies || defaultPolicies();
  return function securityRateLimit(req, res, next) {
    if (
      req.method === "OPTIONS" ||
      isHealthPath(req.path) ||
      (process.env.NODE_ENV === "test" && process.env.SECURITY_RATE_LIMIT_TEST !== "enabled")
    ) {
      return next();
    }
    const policy = resolvePolicy(req, policies);
    const timestamp = now();
    const key = `${policy.name}:${clientAddress(req)}`;
    const recent = (store.get(key) || []).filter((value) => value > timestamp - policy.windowMs);
    recent.push(timestamp);
    store.set(key, recent);
    pruneStore(store, timestamp, policies);
    if (recent.length > policy.max) {
      logSecurityEvent(
        SECURITY_EVENTS.RATE_LIMIT_TRIGGERED,
        req,
        { policy: policy.name, retryAfterSeconds: Math.ceil(policy.windowMs / 1000) },
        logger,
      );
      res.setHeader("Retry-After", String(Math.ceil(policy.windowMs / 1000)));
      return res.status(429).json({
        success: false,
        error: "Muitas requisicoes em pouco tempo. Tente novamente em instantes.",
      });
    }
    return next();
  };
}

function createBruteForceProtection(options = {}) {
  const store = options.store || new Map();
  const logger = options.logger || defaultLogger;
  const now = options.now || Date.now;
  const maxAttempts = positive(options.maxAttempts, process.env.BRUTE_FORCE_MAX_ATTEMPTS, 5);
  const windowMs = positive(options.windowMs, process.env.BRUTE_FORCE_WINDOW_MS, 15 * 60_000);
  const blockMs = positive(options.blockMs, process.env.BRUTE_FORCE_BLOCK_MS, 15 * 60_000);

  function key(req, identifier) {
    const digest = createHash("sha256")
      .update(
        String(identifier || "unknown")
          .trim()
          .toLowerCase(),
      )
      .digest("hex")
      .slice(0, 16);
    return `${clientAddress(req)}:${digest}`;
  }
  function check(req, identifier) {
    const record = store.get(key(req, identifier));
    if (!record || record.blockedUntil <= now()) return false;
    logSecurityEvent(
      SECURITY_EVENTS.BRUTE_FORCE_TRIGGERED,
      req,
      { blockedUntil: new Date(record.blockedUntil).toISOString() },
      logger,
    );
    return true;
  }
  function failure(req, identifier) {
    const timestamp = now();
    const record = store.get(key(req, identifier)) || { attempts: [], blockedUntil: 0 };
    record.attempts = record.attempts.filter((value) => value > timestamp - windowMs);
    record.attempts.push(timestamp);
    if (record.attempts.length >= maxAttempts) {
      record.blockedUntil = timestamp + blockMs;
      logSecurityEvent(
        SECURITY_EVENTS.BRUTE_FORCE_TRIGGERED,
        req,
        {
          attempts: record.attempts.length,
          blockedUntil: new Date(record.blockedUntil).toISOString(),
        },
        logger,
      );
    }
    store.set(key(req, identifier), record);
    return record.blockedUntil > timestamp;
  }
  function success(req, identifier) {
    store.delete(key(req, identifier));
  }
  return { check, failure, success };
}

function createSecurityAuditMiddleware(options = {}) {
  const logger = options.logger || defaultLogger;
  return function securityAudit(req, res, next) {
    res.once("finish", () => {
      if (res.statusCode === 400 || res.statusCode === 422) {
        logSecurityEvent(
          SECURITY_EVENTS.VALIDATION_FAILED,
          req,
          { statusCode: res.statusCode },
          logger,
        );
      } else if (res.statusCode === 401) {
        const event = req.headers?.authorization
          ? SECURITY_EVENTS.TOKEN_INVALID
          : SECURITY_EVENTS.ACCESS_DENIED;
        logSecurityEvent(event, req, { statusCode: res.statusCode }, logger);
      } else if (res.statusCode === 403) {
        logSecurityEvent(
          SECURITY_EVENTS.PERMISSION_DENIED,
          req,
          { statusCode: res.statusCode },
          logger,
        );
      }
    });
    next();
  };
}

function validateAuthInput(req) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return Object.entries(body).every(([key, value]) => {
    if (typeof key !== "string" || key.length > 64) return false;
    if (typeof value === "string") return value.length <= 4096;
    return value == null || typeof value === "boolean" || typeof value === "number";
  });
}

function defaultPolicies() {
  return [
    {
      name: "admin",
      match: (req) => /\/admin(?:\/|$)/.test(req.path || ""),
      max: positive(null, process.env.ADMIN_RATE_LIMIT_MAX, 120),
      windowMs: positive(null, process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 60_000),
    },
    {
      name: "public-sensitive",
      match: (req) => /(?:\/public\/|\/enrollments\/public)/.test(req.path || ""),
      max: positive(null, process.env.PUBLIC_RATE_LIMIT_MAX, 90),
      windowMs: positive(null, process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 60_000),
    },
    {
      name: "default",
      match: () => true,
      max: positive(null, process.env.RATE_LIMIT_MAX, 240),
      windowMs: positive(null, process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    },
  ];
}

function resolvePolicy(req, policies) {
  return policies.find((policy) => policy.match(req)) || policies[policies.length - 1];
}
function positive(primary, secondary, fallback) {
  const value = Number(primary || secondary || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function clientAddress(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function isHealthPath(path) {
  return ["/health", "/api/health", "/live", "/api/live", "/ready", "/api/ready"].includes(path);
}
function isSensitiveRequest(req) {
  return (
    /^\/(?:api\/)?auth(?:\/|$)/.test(req.path || req.originalUrl || "") ||
    Boolean(req.headers?.authorization)
  );
}
function pruneStore(store, timestamp, policies) {
  if (store.size <= 5000) return;
  const longestWindow = Math.max(...policies.map((policy) => policy.windowMs));
  for (const [key, values] of store) {
    if (!values.some((value) => value > timestamp - longestWindow)) store.delete(key);
  }
}

module.exports = {
  SECURITY_EVENTS,
  createBruteForceProtection,
  createSecurityAuditMiddleware,
  createSecurityHeadersMiddleware,
  createSlidingWindowRateLimiter,
  logSecurityEvent,
  validateAuthInput,
};
