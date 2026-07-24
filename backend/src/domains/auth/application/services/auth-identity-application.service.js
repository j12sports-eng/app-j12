const {
  AuthIdentity,
  AuthIdentitySource,
  AuthIdentityStatus,
  normalizeAuthIdentitySource,
  normalizeAuthIdentitySourceUserId,
} = require("../../domain/index.js");

const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const AUTH_IDENTITY_ERROR_CODES = Object.freeze({
  DISABLED: "AUTH_IDENTITY_DISABLED",
  INPUT_INVALID: "AUTH_IDENTITY_INPUT_INVALID",
  NOT_FOUND: "AUTH_IDENTITY_NOT_FOUND",
  PERSISTENCE_FAILED: "AUTH_IDENTITY_PERSISTENCE_FAILED",
  SOURCE_RESOLUTION_FAILED: "AUTH_IDENTITY_SOURCE_RESOLUTION_FAILED",
  SOURCE_RESOLVER_MISSING: "AUTH_IDENTITY_SOURCE_RESOLVER_MISSING",
  SOURCE_UNSUPPORTED: "AUTH_IDENTITY_SOURCE_UNSUPPORTED",
  SOURCE_USER_INACTIVE: "AUTH_IDENTITY_SOURCE_USER_INACTIVE",
  SOURCE_USER_NOT_FOUND: "AUTH_IDENTITY_SOURCE_USER_NOT_FOUND",
  UNEXPECTED_PERSISTENCE_RESULT: "AUTH_IDENTITY_UNEXPECTED_PERSISTENCE_RESULT",
});

const AUTH_IDENTITY_EVENTS = Object.freeze({
  CREATED: "AUTH_IDENTITY_CREATED",
  DISABLED: "AUTH_IDENTITY_DISABLED",
  RESOLVED: "AUTH_IDENTITY_RESOLVED",
});

const RESOLVE_OR_CREATE_FIELDS = new Set(["source", "sourceUserId"]);
const FIND_SOURCE_USER_FIELDS = new Set(["source", "sourceUserId"]);
const FIND_IDENTITY_FIELDS = new Set(["identityId"]);

class AuthIdentityApplicationError extends Error {
  constructor(code, message = "Authentication identity operation was rejected.", options = {}) {
    super(message);
    this.name = "AuthIdentityApplicationError";
    this.code = code;
    this.statusCode = options.statusCode || 400;
    this.expose = true;
  }
}

class AuthIdentityApplicationService {
  constructor({
    authIdentityRepository,
    logger = null,
    resolveJ12UsuariosSourceUser = null,
    resolveUsersSourceUser = null,
  } = {}) {
    this.authIdentityRepository = authIdentityRepository;
    this.logger = logger;
    this.sourceResolvers = Object.freeze({
      [AuthIdentitySource.J12_USUARIOS]: resolveJ12UsuariosSourceUser,
      [AuthIdentitySource.USERS]: resolveUsersSourceUser,
    });
  }

  async resolveOrCreateIdentity(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, RESOLVE_OR_CREATE_FIELDS);
    const source = normalizeSourceOrThrow(safeCommand.source);
    const sourceUserId = normalizeSourceUserIdOrThrow(safeCommand.sourceUserId, source);

    await this.assertSourceUserIsActive(source, sourceUserId);

    const existing = await this.readBySourceUser(source, sourceUserId);
    if (existing) {
      const identity = assertUsableIdentity(existing);
      this.logSafe(AUTH_IDENTITY_EVENTS.RESOLVED, identity, context, "existing");
      return toIdentityResult(identity, { created: false, reused: true });
    }

    try {
      const created = await this.getRepository().create(
        new AuthIdentity({ source, sourceUserId }).toJSON(),
      );
      const identity = assertUsableIdentity(created);
      this.logSafe(AUTH_IDENTITY_EVENTS.CREATED, identity, context, "created");
      return toIdentityResult(identity, { created: true, reused: false });
    } catch (error) {
      if (isAuthIdentityDuplicateEntryError(error)) {
        const identity = assertUsableIdentity(await this.readBySourceUser(source, sourceUserId));
        this.logSafe(AUTH_IDENTITY_EVENTS.RESOLVED, identity, context, "concurrent");
        return toIdentityResult(identity, { created: false, reused: true });
      }
      if (error?.code === AUTH_IDENTITY_ERROR_CODES.DISABLED) throw error;
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.PERSISTENCE_FAILED, 500);
    }
  }

  async findIdentity(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, FIND_IDENTITY_FIELDS);
    const identityId = normalizeIdentityIdOrThrow(safeCommand.identityId);
    const identity = assertUsableIdentity(await this.getRepository().findById(identityId));
    await this.assertSourceUserIsActive(identity.source, identity.sourceUserId);
    this.logSafe(AUTH_IDENTITY_EVENTS.RESOLVED, identity, context, "found_by_id");
    return toIdentityResult(identity, { created: false, reused: true });
  }

  async findBySourceUser(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, FIND_SOURCE_USER_FIELDS);
    const source = normalizeSourceOrThrow(safeCommand.source);
    const sourceUserId = normalizeSourceUserIdOrThrow(safeCommand.sourceUserId, source);
    await this.assertSourceUserIsActive(source, sourceUserId);
    const identity = assertUsableIdentity(await this.readBySourceUser(source, sourceUserId));
    this.logSafe(AUTH_IDENTITY_EVENTS.RESOLVED, identity, context, "found_by_source_user");
    return toIdentityResult(identity, { created: false, reused: true });
  }

  async assertSourceUserIsActive(source, sourceUserId) {
    const resolver = this.sourceResolvers[source];
    if (typeof resolver !== "function") {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_RESOLVER_MISSING, 500);
    }

    let result;
    try {
      result = await resolver({ source, sourceUserId });
    } catch {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_RESOLUTION_FAILED, 500);
    }

    if (!result || typeof result !== "object") {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_NOT_FOUND, 404);
    }

    const resolvedId = normalizeSourceUserIdOrThrow(result.sourceUserId ?? result.id, source);
    if (resolvedId !== sourceUserId) {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_NOT_FOUND, 404);
    }

    if (!isActiveSourceUser(result.status)) {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_INACTIVE, 403);
    }
  }

  async readBySourceUser(source, sourceUserId) {
    try {
      return this.getRepository().findBySourceUser({ source, sourceUserId });
    } catch {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.PERSISTENCE_FAILED, 500);
    }
  }

  getRepository() {
    const repository = this.authIdentityRepository;
    if (
      !repository ||
      typeof repository.create !== "function" ||
      typeof repository.findById !== "function" ||
      typeof repository.findBySourceUser !== "function"
    ) {
      throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.PERSISTENCE_FAILED, 500);
    }
    return repository;
  }

  logSafe(event, identity, context = {}, result = "ok") {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;

    writer("[auth] canonical identity event", {
      action: event,
      actorId: nullableText(context.actorId ?? context.authIdentityId, 64),
      authIdentityId: nullableText(identity?.id, 64),
      correlationId: nullableText(context.correlationId, 96),
      requestId: nullableText(context.requestId, 96),
      result,
      source: nullableText(identity?.source, 32),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unexpected = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unexpected.length > 0) {
    throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.INPUT_INVALID, 400);
  }
  return value;
}

function normalizeSourceOrThrow(value) {
  const source = normalizeAuthIdentitySource(value);
  if (!source) throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.SOURCE_UNSUPPORTED, 400);
  return source;
}

function normalizeSourceUserIdOrThrow(value, source) {
  try {
    return normalizeAuthIdentitySourceUserId(value, source);
  } catch {
    throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.INPUT_INVALID, 400);
  }
}

function normalizeIdentityIdOrThrow(value) {
  try {
    return new AuthIdentity({
      id: value,
      source: AuthIdentitySource.USERS,
      sourceUserId: "identity-probe",
    }).id;
  } catch {
    throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.INPUT_INVALID, 400);
  }
}

function assertUsableIdentity(value) {
  if (!value || typeof value !== "object") {
    throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.NOT_FOUND, 404);
  }
  const identity = value instanceof AuthIdentity ? value : new AuthIdentity(value);
  if (identity.status !== AuthIdentityStatus.ACTIVE) {
    throw authIdentityError(AUTH_IDENTITY_ERROR_CODES.DISABLED, 403);
  }
  return identity;
}

function isActiveSourceUser(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "ativo" || normalized === "active";
}

function toIdentityResult(identity, flags = {}) {
  const record = identity instanceof AuthIdentity ? identity : new AuthIdentity(identity);
  return Object.freeze({
    authIdentityId: record.id,
    created: Boolean(flags.created),
    identity: Object.freeze(record.toJSON()),
    reused: Boolean(flags.reused),
    source: record.source,
  });
}

function authIdentityError(code, statusCode = 400) {
  return new AuthIdentityApplicationError(code, "Authentication identity operation was rejected.", {
    statusCode,
  });
}

function isAuthIdentityDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;
  return duplicateCode || duplicateErrno;
}

function nullableText(value, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.length > max ? raw.slice(0, max) : raw;
}

module.exports = {
  AUTH_IDENTITY_ERROR_CODES,
  AUTH_IDENTITY_EVENTS,
  AuthIdentityApplicationError,
  AuthIdentityApplicationService,
  authIdentityError,
  isActiveSourceUser,
  isAuthIdentityDuplicateEntryError,
  toIdentityResult,
};
