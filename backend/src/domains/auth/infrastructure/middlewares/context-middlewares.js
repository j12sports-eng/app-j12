const { normalizeUnitId } = require("../../domain/index.js");
const {
  ACTOR_CONTEXT_ERROR_CODES,
  actorContextError,
} = require("../../application/services/actor-context-factory.service.js");
const {
  UNIT_CONTEXT_ERROR_CODES,
  unitContextError,
} = require("../../application/services/unit-context-resolver.service.js");

const DEFAULT_UNIT_HEADER_NAME = "x-unit-id";

function createUnitContextMiddleware(options = {}) {
  const authIdentityResolver = getAuthIdentityResolver(options);
  const unitContextResolver = getUnitContextResolver(options);
  const headerName = normalizeHeaderName(options.headerName || DEFAULT_UNIT_HEADER_NAME);

  return async function attachUnitContext(req, _res, next) {
    try {
      const auth = requireAuthenticatedRequest(req);
      const runtimeContext = readRuntimeContext(req);
      const authIdentity = await authIdentityResolver.resolveAuthenticatedAuthIdentity(
        readAuthIdentityInput(auth),
        runtimeContext,
      );
      const requestedUnitId = readRequestedUnitId(req, headerName);
      const unitContext = await unitContextResolver.resolveUnitContext(
        {
          authIdentityId: authIdentity.authIdentityId,
          requestedUnitId,
        },
        {
          ...runtimeContext,
          authIdentityId: authIdentity.authIdentityId,
        },
      );

      req.authIdentityContext = authIdentity;
      req.unitContext = unitContext;
      return next();
    } catch (error) {
      return next(sanitizeMiddlewareError(error, UNIT_CONTEXT_ERROR_CODES.BUILD_FAILED));
    }
  };
}

function createActorContextMiddleware(options = {}) {
  const authIdentityResolver = getAuthIdentityResolver(options);
  const unitContextResolver = getUnitContextResolver(options);
  const actorContextFactory = getActorContextFactory(options);
  const headerName = normalizeHeaderName(options.headerName || DEFAULT_UNIT_HEADER_NAME);

  return async function attachActorContext(req, _res, next) {
    try {
      const auth = requireAuthenticatedRequest(req);
      const runtimeContext = readRuntimeContext(req);
      const authIdentity =
        req.authIdentityContext ||
        (await authIdentityResolver.resolveAuthenticatedAuthIdentity(
          readAuthIdentityInput(auth),
          runtimeContext,
        ));
      const unitContext =
        req.unitContext ||
        (await unitContextResolver.resolveUnitContext(
          {
            authIdentityId: authIdentity.authIdentityId,
            requestedUnitId: readRequestedUnitId(req, headerName),
          },
          {
            ...runtimeContext,
            authIdentityId: authIdentity.authIdentityId,
          },
        ));

      if (!req.authIdentityContext) req.authIdentityContext = authIdentity;
      if (!req.unitContext) req.unitContext = unitContext;

      req.actorContext = actorContextFactory.createActorContext(
        {
          authenticatedAt: auth.authenticatedAt || null,
          authIdentity,
          correlationId: runtimeContext.correlationId,
          globalRole: auth.role || auth.perfil || null,
          issuedAt: auth.issuedAt || auth.iat || null,
          requestId: runtimeContext.requestId,
          unitContext,
        },
        runtimeContext,
      );
      return next();
    } catch (error) {
      return next(sanitizeMiddlewareError(error, ACTOR_CONTEXT_ERROR_CODES.BUILD_FAILED));
    }
  };
}

function getAuthIdentityResolver(options = {}) {
  const resolver = options.authIdentityResolver || options.authenticatedAuthIdentityResolver;
  if (!resolver || typeof resolver.resolveAuthenticatedAuthIdentity !== "function") {
    throw new TypeError("Context middleware requires authenticated auth identity resolver.");
  }
  return resolver;
}

function getUnitContextResolver(options = {}) {
  const resolver = options.unitContextResolver;
  if (!resolver || typeof resolver.resolveUnitContext !== "function") {
    throw new TypeError("Context middleware requires unit context resolver.");
  }
  return resolver;
}

function getActorContextFactory(options = {}) {
  const factory = options.actorContextFactory;
  if (!factory || typeof factory.createActorContext !== "function") {
    throw new TypeError("Actor context middleware requires actor context factory.");
  }
  return factory;
}

function requireAuthenticatedRequest(req = {}) {
  if (!req.auth || typeof req.auth !== "object" || Array.isArray(req.auth)) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.AUTH_REQUIRED, 401);
  }
  return req.auth;
}

function readAuthIdentityInput(auth = {}) {
  return {
    source: auth.source,
    sourceUserId: auth.sourceUserId ?? auth.source_user_id ?? auth.sub ?? auth.id,
  };
}

function readRequestedUnitId(req = {}, headerName = DEFAULT_UNIT_HEADER_NAME) {
  const value = req.headers?.[headerName];
  if (Array.isArray(value)) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT, 400);
  }
  if (value == null || value === "") return null;

  const requested = String(value).trim();
  if (!requested) return null;
  if (requested.includes(",")) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT, 400);
  }

  try {
    return normalizeUnitId(requested);
  } catch {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT, 400);
  }
}

function readRuntimeContext(req = {}) {
  return Object.freeze({
    correlationId: sanitizeRuntimeId(req.correlationId),
    requestId: sanitizeRuntimeId(req.id),
  });
}

function sanitizeRuntimeId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) return null;
  return normalized;
}

function normalizeHeaderName(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(normalized)) {
    throw new TypeError("Context middleware headerName is invalid.");
  }
  return normalized;
}

function sanitizeMiddlewareError(error, fallbackCode) {
  if (error?.code && Number(error?.statusCode || error?.status)) return error;
  if (String(fallbackCode || "").startsWith("ACTOR_CONTEXT")) {
    return actorContextError(fallbackCode, 500);
  }
  return unitContextError(fallbackCode, 500);
}

module.exports = {
  DEFAULT_UNIT_HEADER_NAME,
  attachActorContextMiddleware: createActorContextMiddleware,
  attachUnitContextMiddleware: createUnitContextMiddleware,
  createActorContextMiddleware,
  createUnitContextMiddleware,
  normalizeHeaderName,
  readAuthIdentityInput,
  readRequestedUnitId,
  readRuntimeContext,
};
