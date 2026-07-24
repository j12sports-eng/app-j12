const {
  UnitContext,
  UnitContextResolutionSource,
  normalizeAuthIdentityId,
  normalizeUnitId,
} = require("../../domain/index.js");

const UNIT_CONTEXT_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: "UNIT_CONTEXT_AUTH_REQUIRED",
  BUILD_FAILED: "UNIT_CONTEXT_BUILD_FAILED",
  INVALID_REQUESTED_UNIT: "UNIT_CONTEXT_INVALID_REQUESTED_UNIT",
  MEMBERSHIP_NOT_AVAILABLE: "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE",
  SELECTION_REQUIRED: "UNIT_CONTEXT_SELECTION_REQUIRED",
  STATE_CONFLICT: "UNIT_CONTEXT_STATE_CONFLICT",
  UNIT_NOT_AVAILABLE: "UNIT_CONTEXT_UNIT_NOT_AVAILABLE",
});

const UNIT_CONTEXT_EVENTS = Object.freeze({
  REJECTED: "UNIT_CONTEXT_REJECTED",
  RESOLVED: "UNIT_CONTEXT_RESOLVED",
});

const RESOLVE_FIELDS = new Set(["authIdentityId", "requestedUnitId"]);

class UnitContextResolutionError extends Error {
  constructor(code, statusCode = 403) {
    super(code === UNIT_CONTEXT_ERROR_CODES.SELECTION_REQUIRED
      ? "Unit selection is required."
      : "Unit context is unavailable.");
    this.name = "UnitContextResolutionError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = true;
  }
}

class UnitContextResolverService {
  constructor({
    clock = null,
    logger = null,
    resolveUnit = null,
    userUnitMembershipApplicationService = null,
  } = {}) {
    this.clock = typeof clock === "function" ? clock : () => new Date();
    this.logger = logger;
    this.resolveUnit = resolveUnit;
    this.userUnitMembershipApplicationService = userUnitMembershipApplicationService;
  }

  async resolveUnitContext(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, RESOLVE_FIELDS);
    const authIdentityId = requiredAuthIdentityId(safeCommand.authIdentityId);
    const requestedUnitId =
      safeCommand.requestedUnitId == null || safeCommand.requestedUnitId === ""
        ? null
        : normalizeRequestedUnitId(safeCommand.requestedUnitId);

    let memberships;
    try {
      const result = await this.getMembershipService().listActiveMembershipsByIdentity(
        { authIdentityId },
        toSafeContext(context),
      );
      memberships = Array.isArray(result?.memberships) ? result.memberships.map(normalizeMembership) : [];
    } catch (error) {
      this.logSafe(UNIT_CONTEXT_EVENTS.REJECTED, null, context, "membership_list_failed");
      throw mapMembershipError(error, UNIT_CONTEXT_ERROR_CODES.BUILD_FAILED, 500);
    }

    const selection = selectMembership(memberships, requestedUnitId);

    try {
      await this.assertUnitActive(selection.membership.unitId);
      const revalidated = await this.getMembershipService().checkActiveMembership(
        {
          authIdentityId,
          unitId: selection.membership.unitId,
        },
        toSafeContext(context),
      );
      const membership = normalizeMembership(revalidated?.membership);

      if (
        selection.resolvedBy === UnitContextResolutionSource.DEFAULT_MEMBERSHIP &&
        membership.isDefault !== true
      ) {
        throw unitContextError(UNIT_CONTEXT_ERROR_CODES.STATE_CONFLICT, 409);
      }

      const unitContext = new UnitContext({
        isDefault: membership.isDefault,
        membershipId: membership.id,
        membershipRole: membership.role,
        resolvedAt: this.clock().toISOString(),
        resolvedBy: selection.resolvedBy,
        unitId: membership.unitId,
      });
      this.logSafe(UNIT_CONTEXT_EVENTS.RESOLVED, unitContext, context, "ok");
      return unitContext;
    } catch (error) {
      if (error instanceof UnitContextResolutionError) throw error;
      this.logSafe(UNIT_CONTEXT_EVENTS.REJECTED, selection.membership, context, "validation_failed");
      throw mapMembershipError(error, UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE, 403);
    }
  }

  async assertUnitActive(unitId) {
    if (typeof this.resolveUnit !== "function") {
      throw unitContextError(UNIT_CONTEXT_ERROR_CODES.UNIT_NOT_AVAILABLE, 500);
    }

    let result;
    try {
      result = await this.resolveUnit({ unitId });
    } catch {
      throw unitContextError(UNIT_CONTEXT_ERROR_CODES.UNIT_NOT_AVAILABLE, 403);
    }

    if (!normalizeUnitResult(result, unitId)) {
      throw unitContextError(UNIT_CONTEXT_ERROR_CODES.UNIT_NOT_AVAILABLE, 403);
    }
  }

  getMembershipService() {
    const service = this.userUnitMembershipApplicationService;
    if (
      !service ||
      typeof service.listActiveMembershipsByIdentity !== "function" ||
      typeof service.checkActiveMembership !== "function"
    ) {
      throw unitContextError(UNIT_CONTEXT_ERROR_CODES.BUILD_FAILED, 500);
    }
    return service;
  }

  logSafe(event, unitContextOrMembership, context = {}, result = "ok") {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;
    const source = unitContextOrMembership || {};

    writer("[auth] unit context event", {
      action: event,
      authIdentityId: nullableText(context.authIdentityId, 64),
      correlationId: nullableText(context.correlationId, 96),
      membershipId: nullableText(source.membershipId || source.id, 64),
      membershipRole: nullableText(source.membershipRole || source.role, 32),
      requestId: nullableText(context.requestId, 96),
      resolvedBy: nullableText(source.resolvedBy, 32),
      result,
      unitId: nullableText(source.unitId, 20),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unexpected = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unexpected.length > 0) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT, 400);
  }
  return value;
}

function requiredAuthIdentityId(value) {
  const id = normalizeAuthIdentityId(value);
  if (!id) throw unitContextError(UNIT_CONTEXT_ERROR_CODES.AUTH_REQUIRED, 401);
  return id;
}

function normalizeRequestedUnitId(value) {
  try {
    return normalizeUnitId(value);
  } catch {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT, 400);
  }
}

function selectMembership(memberships, requestedUnitId = null) {
  const activeMemberships = memberships.filter(Boolean);
  const defaults = activeMemberships.filter((membership) => membership.isDefault === true);
  if (defaults.length > 1) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.STATE_CONFLICT, 409);
  }

  if (requestedUnitId) {
    const membership = activeMemberships.find((candidate) => candidate.unitId === requestedUnitId);
    if (!membership) {
      throw unitContextError(UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE, 403);
    }
    return {
      membership,
      resolvedBy: UnitContextResolutionSource.EXPLICIT_REQUEST,
    };
  }

  if (activeMemberships.length === 0) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE, 403);
  }

  if (defaults.length === 1) {
    return {
      membership: defaults[0],
      resolvedBy: UnitContextResolutionSource.DEFAULT_MEMBERSHIP,
    };
  }

  if (activeMemberships.length === 1) {
    return {
      membership: activeMemberships[0],
      resolvedBy: UnitContextResolutionSource.SINGLE_ACTIVE_MEMBERSHIP,
    };
  }

  throw unitContextError(UNIT_CONTEXT_ERROR_CODES.SELECTION_REQUIRED, 409);
}

function normalizeMembership(value) {
  const source = value && typeof value === "object" ? value : {};
  const unitId = normalizeUnitId(source.unitId);
  const id = nullableText(source.id || source.membershipId, 64);
  const role = nullableText(source.role || source.membershipRole, 32);

  if (!id || !role || !unitId) {
    throw unitContextError(UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE, 403);
  }

  return Object.freeze({
    id,
    isDefault: source.isDefault === true,
    role,
    unitId,
  });
}

function normalizeUnitResult(value, expectedUnitId) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const id = normalizeUnitId(source.id ?? source.unitId);
  if (id !== expectedUnitId) return null;
  if (source.active === true) return { id, status: "ativo" };
  const status = String(source.status ?? "").trim().toLowerCase();
  return status === "ativo" ? { id, status } : null;
}

function mapMembershipError(error, fallbackCode, fallbackStatusCode) {
  if (error instanceof UnitContextResolutionError) return error;
  const code = String(error?.code || "");
  if (code.includes("UNIT_NOT_AVAILABLE")) {
    return unitContextError(UNIT_CONTEXT_ERROR_CODES.UNIT_NOT_AVAILABLE, 403);
  }
  if (
    code.includes("NOT_FOUND") ||
    code.includes("INACTIVE") ||
    code.includes("REVOKED") ||
    code.includes("IDENTITY_NOT_AVAILABLE")
  ) {
    return unitContextError(UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE, 403);
  }
  return unitContextError(fallbackCode, fallbackStatusCode);
}

function unitContextError(code, statusCode = 403) {
  return new UnitContextResolutionError(code, statusCode);
}

function toSafeContext(context = {}) {
  return Object.freeze({
    actorAuthIdentityId: nullableText(context.authIdentityId, 64),
    correlationId: nullableText(context.correlationId, 96),
    requestId: nullableText(context.requestId, 96),
  });
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  UNIT_CONTEXT_ERROR_CODES,
  UNIT_CONTEXT_EVENTS,
  UnitContextResolutionError,
  UnitContextResolverService,
  normalizeUnitResult,
  selectMembership,
  unitContextError,
};
