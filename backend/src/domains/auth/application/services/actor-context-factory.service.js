const { ActorContext } = require("../../domain/index.js");

const ACTOR_CONTEXT_ERROR_CODES = Object.freeze({
  BUILD_FAILED: "ACTOR_CONTEXT_BUILD_FAILED",
  INVALID_INPUT: "ACTOR_CONTEXT_INVALID_INPUT",
  NOT_AVAILABLE: "ACTOR_CONTEXT_NOT_AVAILABLE",
});

const ACTOR_CONTEXT_EVENTS = Object.freeze({
  CREATED: "ACTOR_CONTEXT_CREATED",
});

const CREATE_FIELDS = new Set([
  "authenticatedAt",
  "authIdentity",
  "correlationId",
  "globalRole",
  "issuedAt",
  "requestId",
  "unitContext",
]);

class ActorContextError extends Error {
  constructor(code, statusCode = 403) {
    super("Actor context is unavailable.");
    this.name = "ActorContextError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = true;
  }
}

class ActorContextFactoryService {
  constructor({ logger = null } = {}) {
    this.logger = logger;
  }

  createActorContext(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, CREATE_FIELDS);
    const authIdentity = safeCommand.authIdentity;

    if (!authIdentity || typeof authIdentity !== "object") {
      throw actorContextError(ACTOR_CONTEXT_ERROR_CODES.NOT_AVAILABLE, 401);
    }
    if (!safeCommand.unitContext) {
      throw actorContextError(ACTOR_CONTEXT_ERROR_CODES.NOT_AVAILABLE, 403);
    }

    try {
      const actorContext = new ActorContext({
        authenticatedAt: safeCommand.authenticatedAt,
        authIdentityId: authIdentity.authIdentityId || authIdentity.id,
        correlationId: safeCommand.correlationId,
        globalRole: safeCommand.globalRole,
        issuedAt: safeCommand.issuedAt,
        membershipRole: safeCommand.unitContext.membershipRole,
        requestId: safeCommand.requestId,
        source: authIdentity.source,
        sourceUserId: authIdentity.sourceUserId,
        unitContext: safeCommand.unitContext,
      });
      this.logSafe(ACTOR_CONTEXT_EVENTS.CREATED, actorContext, context, "ok");
      return actorContext;
    } catch (error) {
      if (error instanceof ActorContextError) throw error;
      throw actorContextError(ACTOR_CONTEXT_ERROR_CODES.INVALID_INPUT, 400);
    }
  }

  logSafe(event, actorContext, context = {}, result = "ok") {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;

    writer("[auth] actor context event", {
      action: event,
      authIdentityId: nullableText(actorContext?.authIdentityId, 64),
      correlationId: nullableText(context.correlationId || actorContext?.correlationId, 96),
      membershipId: nullableText(actorContext?.unitContext?.membershipId, 64),
      membershipRole: nullableText(actorContext?.membershipRole, 32),
      requestId: nullableText(context.requestId || actorContext?.requestId, 96),
      result,
      unitId: nullableText(actorContext?.unitContext?.unitId, 20),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unexpected = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unexpected.length > 0) {
    throw actorContextError(ACTOR_CONTEXT_ERROR_CODES.INVALID_INPUT, 400);
  }
  return value;
}

function actorContextError(code, statusCode = 403) {
  return new ActorContextError(code, statusCode);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  ACTOR_CONTEXT_ERROR_CODES,
  ACTOR_CONTEXT_EVENTS,
  ActorContextError,
  ActorContextFactoryService,
  actorContextError,
};
