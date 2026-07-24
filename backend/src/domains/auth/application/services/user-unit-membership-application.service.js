const {
  UserUnitMembership,
  UserUnitMembershipStatus,
  normalizeUserUnitMembershipRole,
  normalizeUserUnitMembershipStatus,
  normalizeMembershipId,
  normalizeUnitId,
} = require("../../domain/index.js");

const USER_UNIT_MEMBERSHIP_ERROR_CODES = Object.freeze({
  ALREADY_EXISTS: "USER_UNIT_MEMBERSHIP_ALREADY_EXISTS",
  FORBIDDEN: "USER_UNIT_MEMBERSHIP_FORBIDDEN",
  IDENTITY_NOT_AVAILABLE: "USER_UNIT_MEMBERSHIP_IDENTITY_NOT_AVAILABLE",
  INACTIVE: "USER_UNIT_MEMBERSHIP_INACTIVE",
  INVALID_INPUT: "USER_UNIT_MEMBERSHIP_INVALID_INPUT",
  NOT_FOUND: "USER_UNIT_MEMBERSHIP_NOT_FOUND",
  PERSISTENCE_ERROR: "USER_UNIT_MEMBERSHIP_PERSISTENCE_ERROR",
  REVOKED: "USER_UNIT_MEMBERSHIP_REVOKED",
  STATE_CONFLICT: "USER_UNIT_MEMBERSHIP_STATE_CONFLICT",
  UNIT_NOT_AVAILABLE: "USER_UNIT_MEMBERSHIP_UNIT_NOT_AVAILABLE",
});

const USER_UNIT_MEMBERSHIP_EVENTS = Object.freeze({
  ACCESS_REJECTED: "USER_UNIT_MEMBERSHIP_ACCESS_REJECTED",
  DEFAULT_CHANGED: "USER_UNIT_MEMBERSHIP_DEFAULT_CHANGED",
  DEACTIVATED: "USER_UNIT_MEMBERSHIP_DEACTIVATED",
  GRANTED: "USER_UNIT_MEMBERSHIP_GRANTED",
  REVOKED: "USER_UNIT_MEMBERSHIP_REVOKED",
  ROLE_CHANGED: "USER_UNIT_MEMBERSHIP_ROLE_CHANGED",
});

const GRANT_FIELDS = new Set(["authIdentityId", "role", "unitId"]);
const REVOKE_FIELDS = new Set(["authIdentityId", "membershipId", "unitId"]);
const DEACTIVATE_FIELDS = new Set(["authIdentityId", "membershipId", "unitId"]);
const CHANGE_ROLE_FIELDS = new Set(["authIdentityId", "membershipId", "role", "unitId"]);
const SET_DEFAULT_FIELDS = new Set(["authIdentityId", "membershipId", "unitId"]);
const FIND_FIELDS = new Set(["authIdentityId", "membershipId", "unitId"]);
const LIST_ACTIVE_FIELDS = new Set(["authIdentityId"]);
const CHECK_ACTIVE_FIELDS = new Set(["authIdentityId", "unitId"]);

class UserUnitMembershipApplicationError extends Error {
  constructor(code, message = "User-unit membership operation was rejected.", options = {}) {
    super(message);
    this.name = "UserUnitMembershipApplicationError";
    this.code = code;
    this.statusCode = options.statusCode || 400;
    this.expose = true;
  }
}

class UserUnitMembershipApplicationService {
  constructor({
    authIdentityResolver = null,
    authorizeMembershipAction = null,
    logger = null,
    membershipRepository = null,
    unitResolver = null,
  } = {}) {
    this.authIdentityResolver = authIdentityResolver;
    this.authorizeMembershipAction = authorizeMembershipAction;
    this.logger = logger;
    this.membershipRepository = membershipRepository;
    this.unitResolver = unitResolver;
  }

  async grantMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, GRANT_FIELDS);
    const actorAuthIdentityId = normalizeActorAuthIdentityId(context);
    const authIdentityId = requiredAuthIdentityId(safeCommand.authIdentityId);
    const unitId = normalizeUnitIdOrThrow(safeCommand.unitId);
    const role = normalizeRoleOrThrow(safeCommand.role);

    await this.authorizeOrFail("grantMembership", {
      actorAuthIdentityId,
      authIdentityId,
      role,
      unitId,
    });
    await this.ensureAuthIdentityAvailable(authIdentityId);
    await this.ensureUnitAvailable(unitId);

    const existing = await this.getRepository().findByIdentityAndUnit({ authIdentityId, unitId });
    if (existing) {
      const membership = normalizeMembership(existing);
      if (membership.status === UserUnitMembershipStatus.ACTIVE) {
        this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.GRANTED, membership, context, "reused");
        return toMembershipResult(membership, { created: false, reused: true });
      }

      throw controlledMembershipError(
        membership.status === UserUnitMembershipStatus.REVOKED
          ? USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED
          : USER_UNIT_MEMBERSHIP_ERROR_CODES.STATE_CONFLICT,
        membership.status === UserUnitMembershipStatus.REVOKED ? 409 : 409,
      );
    }

    const membershipInput = new UserUnitMembership({
      authIdentityId,
      createdByAuthIdentityId: actorAuthIdentityId,
      isDefault: false,
      role,
      status: UserUnitMembershipStatus.ACTIVE,
      unitId,
    }).toJSON();

    try {
      const created = await this.getRepository().create(membershipInput);
      const membership = normalizeMembership(created);
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.GRANTED, membership, context, "created");
      return toMembershipResult(membership, { created: true, reused: false });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const retry = await this.getRepository().findByIdentityAndUnit({ authIdentityId, unitId });
        if (!retry) {
          throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
        }

        const membership = normalizeMembership(retry);
        if (membership.status === UserUnitMembershipStatus.ACTIVE) {
          this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.GRANTED, membership, context, "reused");
          return toMembershipResult(membership, { created: false, reused: true });
        }

        throw controlledMembershipError(
          membership.status === UserUnitMembershipStatus.REVOKED
            ? USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED
            : USER_UNIT_MEMBERSHIP_ERROR_CODES.STATE_CONFLICT,
          409,
        );
      }

      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async revokeMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, REVOKE_FIELDS);
    const actorAuthIdentityId = normalizeActorAuthIdentityId(context);
    const membership = await this.resolveMembershipTarget(safeCommand);

    await this.authorizeOrFail("revokeMembership", {
      actorAuthIdentityId,
      authIdentityId: membership.authIdentityId,
      membershipId: membership.id,
      unitId: membership.unitId,
    });

    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.REVOKED, membership, context, "reused");
      return toMembershipResult(membership, { created: false, reused: true, changed: false });
    }

    try {
      const result = await this.getRepository().revoke({
        membershipId: membership.id,
        revokedByAuthIdentityId: actorAuthIdentityId,
        revokedAt: nowSqlDateTime(),
      });
      const revoked = normalizeMembership(result.membership || membership);
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.REVOKED, revoked, context, "updated");
      return toMembershipResult(revoked, {
        changed: result.changed,
        created: false,
        previousStatus: membership.status,
        reused: false,
      });
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async deactivateMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, DEACTIVATE_FIELDS);
    const actorAuthIdentityId = normalizeActorAuthIdentityId(context);
    const membership = await this.resolveMembershipTarget(safeCommand);

    await this.authorizeOrFail("deactivateMembership", {
      actorAuthIdentityId,
      authIdentityId: membership.authIdentityId,
      membershipId: membership.id,
      unitId: membership.unitId,
    });

    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED, 409);
    }
    if (membership.status === UserUnitMembershipStatus.INACTIVE) {
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.DEACTIVATED, membership, context, "reused");
      return toMembershipResult(membership, { changed: false, created: false, reused: true });
    }

    try {
      const result = await this.getRepository().deactivate({
        deactivatedAt: nowSqlDateTime(),
        membershipId: membership.id,
      });
      const deactivated = normalizeMembership(result.membership || membership);
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.DEACTIVATED, deactivated, context, "updated");
      return toMembershipResult(deactivated, {
        changed: result.changed,
        created: false,
        previousStatus: membership.status,
        reused: false,
      });
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async changeMembershipRole(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, CHANGE_ROLE_FIELDS);
    const actorAuthIdentityId = normalizeActorAuthIdentityId(context);
    const membership = await this.resolveMembershipTarget(safeCommand);
    const nextRole = normalizeRoleOrThrow(safeCommand.role);

    await this.authorizeOrFail("changeMembershipRole", {
      actorAuthIdentityId,
      authIdentityId: membership.authIdentityId,
      membershipId: membership.id,
      nextRole,
      previousRole: membership.role,
      unitId: membership.unitId,
    });

    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED, 409);
    }
    if (membership.role === nextRole) {
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.ROLE_CHANGED, membership, context, "reused");
      return toMembershipResult(membership, {
        changed: false,
        created: false,
        previousRole: membership.role,
        reused: true,
      });
    }

    try {
      const result = await this.getRepository().changeRole({
        membershipId: membership.id,
        role: nextRole,
      });
      const updated = normalizeMembership(result.membership || membership);
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.ROLE_CHANGED, updated, context, "updated", {
        previousRole: result.previousRole || membership.role,
      });
      return toMembershipResult(updated, {
        changed: result.changed,
        created: false,
        previousRole: result.previousRole || membership.role,
        reused: false,
      });
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async setDefaultMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, SET_DEFAULT_FIELDS);
    const actorAuthIdentityId = normalizeActorAuthIdentityId(context);
    const membership = await this.resolveMembershipTarget(safeCommand);

    await this.authorizeOrFail("setDefaultMembership", {
      actorAuthIdentityId,
      authIdentityId: membership.authIdentityId,
      membershipId: membership.id,
      unitId: membership.unitId,
    });

    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED, 409);
    }
    if (membership.status === UserUnitMembershipStatus.INACTIVE) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INACTIVE, 409);
    }
    if (membership.isDefault) {
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.DEFAULT_CHANGED, membership, context, "reused");
      return toMembershipResult(membership, {
        changed: false,
        created: false,
        previousDefaultMembershipId: membership.id,
        reused: true,
      });
    }

    try {
      const result = await this.getRepository().setDefaultTransactionally({
        authIdentityId: membership.authIdentityId,
        membershipId: membership.id,
        unitId: membership.unitId,
      });

      const updated = normalizeMembership(result.membership || membership);
      this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.DEFAULT_CHANGED, updated, context, "updated", {
        previousDefaultMembershipId: result.previousDefault?.id || null,
      });

      return toMembershipResult(updated, {
        changed: result.changed,
        created: false,
        previousDefaultMembershipId: result.previousDefault?.id || null,
        reused: result.reused,
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const reread = await this.getRepository().findById(membership.id);
        if (!reread) {
          throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
        }
        const current = normalizeMembership(reread);
        this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.DEFAULT_CHANGED, current, context, "raced");
        return toMembershipResult(current, {
          changed: false,
          created: false,
          previousDefaultMembershipId: current.isDefault ? current.id : null,
          reused: true,
        });
      }

      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async findMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, FIND_FIELDS);
    const membership = await this.resolveMembershipLookup(safeCommand);
    if (!membership) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.NOT_FOUND, 404);
    }

    this.logMembership("USER_UNIT_MEMBERSHIP_FOUND", membership, context, "found");
    return toMembershipResult(membership, { created: false, reused: true });
  }

  async listActiveMembershipsByIdentity(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, LIST_ACTIVE_FIELDS);
    const authIdentityId = requiredAuthIdentityId(safeCommand.authIdentityId);
    await this.ensureAuthIdentityAvailable(authIdentityId);

    try {
      const memberships = await this.getRepository().listActiveByIdentity(authIdentityId);
      const normalized = memberships.map(normalizeMembership).map((membership) => membership.toJSON());
      this.logMembership(
        "USER_UNIT_MEMBERSHIP_LISTED",
        null,
        context,
        "ok",
        { authIdentityId, count: normalized.length },
      );
      return Object.freeze({
        authIdentityId,
        memberships: Object.freeze(normalized),
      });
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async checkActiveMembership(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, CHECK_ACTIVE_FIELDS);
    const authIdentityId = requiredAuthIdentityId(safeCommand.authIdentityId);
    const unitId = normalizeUnitIdOrThrow(safeCommand.unitId);

    await this.ensureAuthIdentityAvailable(authIdentityId);
    await this.ensureUnitAvailable(unitId);

    try {
      const active = await this.getRepository().checkActive({ authIdentityId, unitId });
      if (active) {
        const membership = normalizeMembership(active);
        this.logMembership(USER_UNIT_MEMBERSHIP_EVENTS.ACCESS_REJECTED, membership, context, "allowed");
        return toMembershipResult(membership, { created: false, reused: true });
      }

      const current = await this.getRepository().findByIdentityAndUnit({ authIdentityId, unitId });
      if (!current) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.NOT_FOUND, 404);
      }

      const membership = normalizeMembership(current);
      if (membership.status === UserUnitMembershipStatus.REVOKED) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED, 409);
      }
      if (membership.status === UserUnitMembershipStatus.INACTIVE) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INACTIVE, 409);
      }

      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.STATE_CONFLICT, 409);
    } catch (error) {
      if (error && error.code) throw error;
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async resolveMembershipLookup(command = {}) {
    if (command.membershipId) {
      const membership = await this.getRepository().findById(normalizeMembershipId(command.membershipId));
      if (!membership) return null;
      if (command.authIdentityId || command.unitId) {
        const targetAuthIdentityId = command.authIdentityId
          ? requiredAuthIdentityId(command.authIdentityId)
          : null;
        const targetUnitId = command.unitId ? normalizeUnitIdOrThrow(command.unitId) : null;
        if (
          (targetAuthIdentityId && targetAuthIdentityId !== membership.authIdentityId) ||
          (targetUnitId && targetUnitId !== membership.unitId)
        ) {
          throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
        }
      }
      return normalizeMembership(membership);
    }

    if (command.authIdentityId && command.unitId) {
      const membership = await this.getRepository().findByIdentityAndUnit({
        authIdentityId: requiredAuthIdentityId(command.authIdentityId),
        unitId: normalizeUnitIdOrThrow(command.unitId),
      });
      return membership ? normalizeMembership(membership) : null;
    }

    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }

  async resolveMembershipTarget(command = {}) {
    const membership = await this.resolveMembershipLookup(command);
    if (!membership) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.NOT_FOUND, 404);
    }
    return membership;
  }

  async authorizeOrFail(action, input) {
    if (typeof this.authorizeMembershipAction !== "function") {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.FORBIDDEN, 403);
    }

    try {
      const authorized = await this.authorizeMembershipAction(Object.freeze({
        action,
        ...input,
      }));
      if (authorized !== true) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.FORBIDDEN, 403);
      }
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async ensureAuthIdentityAvailable(authIdentityId) {
    const resolver = this.authIdentityResolver;
    if (typeof resolver !== "function") {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.IDENTITY_NOT_AVAILABLE, 404);
    }

    try {
      const result = await resolver({ authIdentityId });
      const normalized = normalizeAuthIdentityResult(result);
      if (!normalized) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.IDENTITY_NOT_AVAILABLE, 404);
      }
      return normalized;
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.IDENTITY_NOT_AVAILABLE, 404);
    }
  }

  async ensureUnitAvailable(unitId) {
    const resolver = this.unitResolver;
    if (typeof resolver !== "function") {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.UNIT_NOT_AVAILABLE, 404);
    }

    try {
      const result = await resolver({ unitId });
      const normalized = normalizeUnitResult(result);
      if (!normalized) {
        throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.UNIT_NOT_AVAILABLE, 404);
      }
      return normalized;
    } catch {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.UNIT_NOT_AVAILABLE, 404);
    }
  }

  getRepository() {
    const repository = this.membershipRepository;
    if (
      !repository ||
      typeof repository.create !== "function" ||
      typeof repository.findById !== "function" ||
      typeof repository.findByIdentityAndUnit !== "function"
    ) {
      throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
    return repository;
  }

  logMembership(event, membership, context = {}, result = "ok", extra = {}) {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;

    const safeMembership = membership ? normalizeMembership(membership).toJSON() : {};
    writer("[auth] user-unit membership event", {
      action: event,
      actorAuthIdentityId: nullableText(context.actorAuthIdentityId, 64),
      authIdentityId: nullableText(safeMembership.authIdentityId, 64),
      correlationId: nullableText(context.correlationId, 96),
      membershipId: nullableText(safeMembership.id, 64),
      previousRole: nullableText(extra.previousRole, 32),
      previousDefaultMembershipId: nullableText(extra.previousDefaultMembershipId, 64),
      requestId: nullableText(context.requestId, 96),
      result,
      role: nullableText(safeMembership.role, 32),
      status: nullableText(safeMembership.status, 32),
      unitId: nullableText(safeMembership.unitId, 20),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unexpected = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unexpected.length > 0) {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }
  return value;
}

function normalizeActorAuthIdentityId(context = {}) {
  const actorAuthIdentityId = normalizeAuthIdentityId(context.actorAuthIdentityId);
  if (!actorAuthIdentityId) {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.FORBIDDEN, 403);
  }
  return actorAuthIdentityId;
}

function normalizeAuthIdentityId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > 64) {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }
  return normalized;
}

function requiredAuthIdentityId(value) {
  const normalized = normalizeAuthIdentityId(value);
  if (!normalized) {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }
  return normalized;
}

function normalizeUnitIdOrThrow(value) {
  try {
    return normalizeUnitId(value);
  } catch {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }
}

function normalizeRoleOrThrow(value) {
  const role = normalizeUserUnitMembershipRole(value);
  if (!role) {
    throw controlledMembershipError(USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT, 400);
  }
  return role;
}

function normalizeAuthIdentityResult(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const id = normalizeAuthIdentityId(source.id ?? source.authIdentityId);
  const status = String(source.status ?? "").trim().toUpperCase();
  if (!id || status !== "ACTIVE") return null;
  return { id, status };
}

function normalizeUnitResult(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const id = normalizeUnitId(source.id ?? source.unitId);
  if (!id) return null;
  if (source.active === true) return { id, status: "ativo" };
  const status = String(source.status ?? "").trim().toLowerCase();
  if (status !== "ativo") return null;
  return { id, status };
}

function normalizeMembership(value) {
  return value instanceof UserUnitMembership ? value : new UserUnitMembership(value);
}

function toMembershipResult(membership, flags = {}) {
  const record = normalizeMembership(membership);
  return Object.freeze({
    changed: Boolean(flags.changed),
    created: Boolean(flags.created),
    membership: Object.freeze(toMembershipDto(record)),
    previousDefaultMembershipId: nullableText(flags.previousDefaultMembershipId, 64),
    previousRole: nullableText(flags.previousRole, 32),
    reused: Boolean(flags.reused),
  });
}

function toMembershipDto(membership) {
  const record = normalizeMembership(membership).toJSON();
  return {
    authIdentityId: record.authIdentityId,
    createdAt: record.createdAt,
    createdByAuthIdentityId: record.createdByAuthIdentityId,
    id: record.id,
    isDefault: record.isDefault,
    revokedAt: record.revokedAt,
    status: record.status,
    unitId: record.unitId,
    updatedAt: record.updatedAt,
    role: record.role,
  };
}

function isDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  return String(error.code ?? "") === "ER_DUP_ENTRY" || Number(error.errno ?? error.code) === 1062;
}

function controlledMembershipError(code, statusCode = 400) {
  const error = new UserUnitMembershipApplicationError(
    code,
    "User-unit membership operation was rejected.",
    { statusCode },
  );
  return error;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function nowSqlDateTime() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  USER_UNIT_MEMBERSHIP_ERROR_CODES,
  USER_UNIT_MEMBERSHIP_EVENTS,
  UserUnitMembershipApplicationError,
  UserUnitMembershipApplicationService,
  controlledMembershipError,
  isDuplicateEntryError,
  normalizeAuthIdentityId,
  normalizeAuthIdentityResult,
  normalizeUnitResult,
  requiredAuthIdentityId,
  toMembershipDto,
  toMembershipResult,
};
