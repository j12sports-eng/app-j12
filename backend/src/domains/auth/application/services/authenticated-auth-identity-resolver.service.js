const {
  normalizeAuthIdentitySource,
  normalizeAuthIdentitySourceUserId,
} = require("../../domain/index.js");

const AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "AUTH_IDENTITY_CONTEXT_INVALID_INPUT",
  NOT_AVAILABLE: "AUTH_IDENTITY_CONTEXT_NOT_AVAILABLE",
});

const AUTHENTICATED_AUTH_IDENTITY_EVENTS = Object.freeze({
  RESOLVED: "AUTH_IDENTITY_CONTEXT_RESOLVED",
  REJECTED: "AUTH_IDENTITY_CONTEXT_REJECTED",
});

const RESOLVE_FIELDS = new Set(["source", "sourceUserId"]);

class AuthenticatedAuthIdentityContextError extends Error {
  constructor(code, statusCode = 403) {
    super("Authentication identity context is unavailable.");
    this.name = "AuthenticatedAuthIdentityContextError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = true;
  }
}

class AuthenticatedAuthIdentityResolverService {
  constructor({ authIdentityApplicationService = null, clock = null, logger = null } = {}) {
    this.authIdentityApplicationService = authIdentityApplicationService;
    this.clock = typeof clock === "function" ? clock : () => new Date();
    this.logger = logger;
  }

  async resolveAuthenticatedAuthIdentity(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, RESOLVE_FIELDS);
    const source = normalizeSourceOrThrow(safeCommand.source);
    const sourceUserId = normalizeSourceUserIdOrThrow(safeCommand.sourceUserId, source);

    try {
      const result = await this.getAuthIdentityService().findBySourceUser(
        { source, sourceUserId },
        {
          correlationId: nullableText(context.correlationId, 96),
          requestId: nullableText(context.requestId, 96),
        },
      );

      const authIdentityId = nullableText(result?.authIdentityId || result?.identity?.id, 64);
      if (!authIdentityId) {
        throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE, 403);
      }

      const resolved = Object.freeze({
        authIdentityId,
        resolvedAt: this.clock().toISOString(),
        source,
        sourceUserId,
      });
      this.logSafe(AUTHENTICATED_AUTH_IDENTITY_EVENTS.RESOLVED, resolved, context, "ok");
      return resolved;
    } catch (error) {
      if (error instanceof AuthenticatedAuthIdentityContextError) throw error;
      this.logSafe(
        AUTHENTICATED_AUTH_IDENTITY_EVENTS.REJECTED,
        { source },
        context,
        "rejected",
      );
      throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE, 403);
    }
  }

  getAuthIdentityService() {
    const service = this.authIdentityApplicationService;
    if (!service || typeof service.findBySourceUser !== "function") {
      throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE, 500);
    }
    return service;
  }

  logSafe(event, identity = {}, context = {}, result = "ok") {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;

    writer("[auth] authenticated identity context event", {
      action: event,
      authIdentityId: nullableText(identity.authIdentityId, 64),
      correlationId: nullableText(context.correlationId, 96),
      requestId: nullableText(context.requestId, 96),
      result,
      source: nullableText(identity.source, 32),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unexpected = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unexpected.length > 0) {
    throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT, 400);
  }
  return value;
}

function normalizeSourceOrThrow(value) {
  const source = normalizeAuthIdentitySource(value);
  if (!source) {
    throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT, 400);
  }
  return source;
}

function normalizeSourceUserIdOrThrow(value, source) {
  try {
    return normalizeAuthIdentitySourceUserId(value, source);
  } catch {
    throw contextError(AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT, 400);
  }
}

function contextError(code, statusCode = 403) {
  return new AuthenticatedAuthIdentityContextError(code, statusCode);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES,
  AUTHENTICATED_AUTH_IDENTITY_EVENTS,
  AuthenticatedAuthIdentityContextError,
  AuthenticatedAuthIdentityResolverService,
  contextError,
};
