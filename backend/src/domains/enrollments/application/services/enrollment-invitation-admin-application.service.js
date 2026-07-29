const { normalizeEnrollmentStatus } = require("../../domain/enums/enrollment-status.enum.js");
const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../../domain/enums/enrollment-digital-invitation-status.enum.js");
const {
  ENROLLMENT_INVITATION_ADMIN_ALLOWED_ROLES,
  EnrollmentInvitationAdminAction,
  assertEnrollmentInvitationAdminRole,
} = require("../security/enrollment-invitation-role.guard.js");

const ENROLLMENT_INVITATION_ADMIN_ERROR_CODES = Object.freeze({
  FORBIDDEN: "ENROLLMENT_INVITATION_ADMIN_FORBIDDEN",
  INPUT_INVALID: "ENROLLMENT_INVITATION_ADMIN_INPUT_INVALID",
  NOT_AVAILABLE: "ENROLLMENT_INVITATION_ADMIN_NOT_AVAILABLE",
  PERSISTENCE_ERROR: "ENROLLMENT_INVITATION_ADMIN_PERSISTENCE_ERROR",
  STATE_CONFLICT: "ENROLLMENT_INVITATION_ADMIN_STATE_CONFLICT",
});

const ENROLLMENT_INVITATION_ADMIN_EVENTS = Object.freeze({
  CREATED: "ENROLLMENT_INVITATION_ADMIN_CREATED",
  REJECTED: "ENROLLMENT_INVITATION_ADMIN_REJECTED",
  RENEWED: "ENROLLMENT_INVITATION_ADMIN_RENEWED",
  REVOKED: "ENROLLMENT_INVITATION_ADMIN_REVOKED",
  VIEWED: "ENROLLMENT_INVITATION_ADMIN_VIEWED",
});

const COMMAND_FIELDS = new Set(["durationSeconds", "enrollmentId"]);
const REVOKE_FIELDS = new Set(["enrollmentId"]);
const VIEW_FIELDS = new Set(["enrollmentId"]);

class EnrollmentInvitationAdminApplicationError extends Error {
  constructor(code, statusCode = 400) {
    super(publicMessageFor(code));
    this.name = "EnrollmentInvitationAdminApplicationError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = true;
  }
}

class EnrollmentInvitationAdminApplicationService {
  constructor({
    enrollmentReader = null,
    invitationRepository = null,
    invitationService = null,
    logger = null,
    unitContextResolver = null,
  } = {}) {
    this.enrollmentReader = enrollmentReader;
    this.invitationRepository = invitationRepository;
    this.invitationService = invitationService;
    this.logger = logger;
    this.unitContextResolver = unitContextResolver;
  }

  async create(command = {}, context = {}) {
    return this.executeMutation(
      EnrollmentInvitationAdminAction.CREATE_INVITATION,
      ENROLLMENT_INVITATION_ADMIN_EVENTS.CREATED,
      command,
      context,
      COMMAND_FIELDS,
      async ({ actor, enrollmentId }) => {
        const result = await this.getInvitationService().createInvitation(
          pickDurationCommand(command, enrollmentId),
          toInvitationServiceContext(actor),
        );
        await this.assertInvitationUnit(result, actor.unitId);
        return Object.freeze({
          invitation: toSafeInvitationDto(result),
          rawToken: nullableText(result?.rawToken, 256),
        });
      },
    );
  }

  async renew(command = {}, context = {}) {
    return this.executeMutation(
      EnrollmentInvitationAdminAction.RENEW_INVITATION,
      ENROLLMENT_INVITATION_ADMIN_EVENTS.RENEWED,
      command,
      context,
      COMMAND_FIELDS,
      async ({ actor, enrollmentId }) => {
        const result = await this.getInvitationService().renewInvitation(
          pickDurationCommand(command, enrollmentId),
          toInvitationServiceContext(actor),
        );
        await this.assertInvitationUnit(result, actor.unitId);
        return Object.freeze({
          invitation: toSafeInvitationDto(result),
          rawToken: nullableText(result?.rawToken, 256),
        });
      },
    );
  }

  async revoke(command = {}, context = {}) {
    return this.executeMutation(
      EnrollmentInvitationAdminAction.REVOKE_INVITATION,
      ENROLLMENT_INVITATION_ADMIN_EVENTS.REVOKED,
      command,
      context,
      REVOKE_FIELDS,
      async ({ actor, enrollmentId }) => {
        const current = await this.findCurrentInvitation(enrollmentId);
        if (!current) {
          return Object.freeze({
            changed: false,
            invitation: null,
            status: EnrollmentDigitalInvitationStatus.REVOKED,
          });
        }

        await this.assertInvitationUnit(current, actor.unitId);
        const result = await this.getInvitationService().revokeInvitation(
          { invitationId: readProperty(current, "id") },
          toInvitationServiceContext(actor),
        );

        return Object.freeze({
          changed: Boolean(result?.changed),
          invitation: toSafeInvitationDto({
            ...current,
            status:
              normalizeEnrollmentDigitalInvitationStatus(result?.status) ||
              EnrollmentDigitalInvitationStatus.REVOKED,
          }),
          status:
            normalizeEnrollmentDigitalInvitationStatus(result?.status) ||
            EnrollmentDigitalInvitationStatus.REVOKED,
        });
      },
    );
  }

  async getCurrent(command = {}, context = {}) {
    const safeCommand = validateAllowedFields(command, VIEW_FIELDS);
    const enrollmentId = requiredEnrollmentId(safeCommand.enrollmentId);
    const actor = await this.prepareActor(context.actorContext, EnrollmentInvitationAdminAction.VIEW_INVITATION);

    try {
      await this.loadOwnedDraftEnrollment(enrollmentId, actor.unitId);
      const invitation = await this.findCurrentInvitation(enrollmentId);
      if (invitation) await this.assertInvitationUnit(invitation, actor.unitId);
      const result = Object.freeze({ invitation: invitation ? toSafeInvitationDto(invitation) : null });
      this.logSafe(ENROLLMENT_INVITATION_ADMIN_EVENTS.VIEWED, {
        actor,
        enrollmentId,
        invitationId: result.invitation?.id,
        result: "viewed",
      });
      return result;
    } catch (error) {
      this.logSafe(ENROLLMENT_INVITATION_ADMIN_EVENTS.REJECTED, {
        actor,
        code: safeCode(error),
        enrollmentId,
        result: "rejected",
      });
      throw mapAdminError(error);
    }
  }

  async executeMutation(action, event, command, context, allowedFields, work) {
    const safeCommand = validateAllowedFields(command, allowedFields);
    const enrollmentId = requiredEnrollmentId(safeCommand.enrollmentId);
    const actor = await this.prepareActor(context.actorContext, action);

    try {
      await this.loadOwnedDraftEnrollment(enrollmentId, actor.unitId);
      const result = await work({ actor, enrollmentId });
      this.logSafe(event, {
        actor,
        enrollmentId,
        invitationId: result?.invitation?.id,
        result: "ok",
      });
      return result;
    } catch (error) {
      this.logSafe(ENROLLMENT_INVITATION_ADMIN_EVENTS.REJECTED, {
        actor,
        code: safeCode(error),
        enrollmentId,
        result: "rejected",
      });
      throw mapAdminError(error);
    }
  }

  async prepareActor(actorContext, action) {
    const actor = readActorContext(actorContext);
    assertEnrollmentInvitationAdminRole(
      { membershipRole: actor.membershipRole },
      action,
    );

    if (this.unitContextResolver && typeof this.unitContextResolver.resolveUnitContext === "function") {
      let unitContext;
      try {
        unitContext = await this.unitContextResolver.resolveUnitContext(
          {
            authIdentityId: actor.authIdentityId,
            requestedUnitId: null,
          },
          {
            authIdentityId: actor.authIdentityId,
            correlationId: actor.correlationId,
            requestId: actor.requestId,
          },
        );
      } catch {
        throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE, 404);
      }
      actor.unitContext = unitContext;
      actor.unitId = nullableText(unitContext?.unitId, 64);
      actor.membershipRole = nullableText(unitContext?.membershipRole, 32);
      assertEnrollmentInvitationAdminRole({ membershipRole: actor.membershipRole }, action);
    }

    return Object.freeze(actor);
  }

  async loadOwnedDraftEnrollment(enrollmentId, unitId) {
    let enrollment;
    try {
      enrollment = await this.readEnrollment(enrollmentId);
    } catch {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }

    if (!enrollment) {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE, 404);
    }

    const status = normalizeEnrollmentStatus(readProperty(enrollment, "status"));
    if (status !== "DRAFT") {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT, 409);
    }

    const enrollmentUnitId = readEnrollmentUnitId(enrollment);
    if (!enrollmentUnitId || enrollmentUnitId !== unitId) {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE, 404);
    }

    return enrollment;
  }

  async assertInvitationUnit(invitation, unitId) {
    const source = readObject(invitation?.invitation || invitation);
    const invitationUnitId = nullableText(
      readProperty(source, "unitId") ?? readProperty(source, "unit_id"),
      64,
    );
    if (!invitationUnitId || invitationUnitId !== unitId) {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE, 404);
    }
  }

  async findCurrentInvitation(enrollmentId) {
    try {
      const repository = this.getInvitationRepository();
      if (typeof repository.findActiveByEnrollment !== "function") {
        throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
      }
      return repository.findActiveByEnrollment(enrollmentId);
    } catch (error) {
      if (error instanceof EnrollmentInvitationAdminApplicationError) throw error;
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
  }

  async readEnrollment(enrollmentId) {
    const reader = this.enrollmentReader;
    if (typeof reader?.findEnrollmentById === "function") {
      return reader.findEnrollmentById(enrollmentId);
    }
    if (typeof reader?.findById === "function") {
      return reader.findById(enrollmentId);
    }
    throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
  }

  getInvitationService() {
    const service = this.invitationService;
    if (
      !service ||
      typeof service.createInvitation !== "function" ||
      typeof service.renewInvitation !== "function" ||
      typeof service.revokeInvitation !== "function"
    ) {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
    return service;
  }

  getInvitationRepository() {
    const repository = this.invitationRepository;
    if (!repository || typeof repository.findActiveByEnrollment !== "function") {
      throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
    }
    return repository;
  }

  logSafe(action, input = {}) {
    const writer = typeof this.logger?.info === "function" ? this.logger.info.bind(this.logger) : null;
    if (!writer) return;
    const actor = input.actor || {};

    writer("[enrollments] invitation admin audit", {
      action,
      authIdentityId: nullableText(actor.authIdentityId, 64),
      correlationId: nullableText(actor.correlationId, 96),
      enrollmentId: nullableText(input.enrollmentId, 64),
      invitationId: nullableText(input.invitationId, 64),
      membershipRole: nullableText(actor.membershipRole, 32),
      requestId: nullableText(actor.requestId, 96),
      result: nullableText(input.result, 32),
      unitId: nullableText(actor.unitId, 64),
    });
  }
}

function validateAllowedFields(input, allowedFields) {
  const source = readObject(input);
  const unexpected = Object.keys(source).filter((key) => !allowedFields.has(key));
  if (unexpected.length > 0) {
    throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }
  return source;
}

function requiredEnrollmentId(value) {
  const enrollmentId = nullableText(value, 64);
  if (!enrollmentId || !/^[A-Za-z0-9._:-]{1,64}$/.test(enrollmentId)) {
    throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }
  return enrollmentId;
}

function readActorContext(actorContext) {
  const unitContext = actorContext?.unitContext || {};
  const actor = {
    authIdentityId: nullableText(actorContext?.authIdentityId, 64),
    correlationId: nullableText(actorContext?.correlationId, 96),
    membershipRole: nullableText(actorContext?.membershipRole || unitContext.membershipRole, 32),
    requestId: nullableText(actorContext?.requestId, 96),
    unitContext,
    unitId: nullableText(unitContext.unitId, 64),
  };

  if (!actor.authIdentityId || !actor.unitId || !actor.membershipRole || !actor.requestId || !actor.correlationId) {
    throw adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN, 403);
  }

  return actor;
}

function readEnrollmentUnitId(enrollment) {
  return nullableText(
    readProperty(enrollment, "unitId") ??
      readProperty(enrollment, "unit_id") ??
      readProperty(enrollment, "unidadeId") ??
      readProperty(enrollment, "unidade_id"),
    64,
  );
}

function pickDurationCommand(command, enrollmentId) {
  const source = readObject(command);
  const output = { enrollmentId };
  if (source.durationSeconds != null) output.durationSeconds = source.durationSeconds;
  return output;
}

function toInvitationServiceContext(actor) {
  return Object.freeze({
    actorId: actor.authIdentityId,
    correlationId: actor.correlationId,
    requestId: actor.requestId,
    unitId: actor.unitId,
  });
}

function toSafeInvitationDto(invitation) {
  if (!invitation || typeof invitation !== "object") return null;
  return Object.freeze({
    createdAt: readProperty(invitation, "createdAt"),
    enrollmentId: readProperty(invitation, "enrollmentId"),
    expiresAt: readProperty(invitation, "expiresAt"),
    id: readProperty(invitation, "id") ?? readProperty(invitation, "invitationId"),
    status: normalizeEnrollmentDigitalInvitationStatus(readProperty(invitation, "status")),
    unitId: readProperty(invitation, "unitId"),
  });
}

function mapAdminError(error) {
  if (error instanceof EnrollmentInvitationAdminApplicationError) return error;
  const code = nullableText(error?.code, 100);
  if (code === "ENROLLMENT_INVITATION_ALREADY_ACTIVE") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT, 409);
  }
  if (code === "ENROLLMENT_INVITATION_FORBIDDEN") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN, 403);
  }
  if (code === "ENROLLMENT_INVITATION_INVALID_INPUT") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }
  if (code === "ENROLLMENT_INVITATION_STATE_CONFLICT") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT, 409);
  }
  if (code === "ENROLLMENT_INVITATION_NOT_AVAILABLE") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE, 404);
  }
  if (code === "ENROLLMENT_INVITATION_ADMIN_FORBIDDEN") {
    return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN, 403);
  }
  return adminError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR, 500);
}

function adminError(code, statusCode = 400) {
  return new EnrollmentInvitationAdminApplicationError(code, statusCode);
}

function publicMessageFor(code) {
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN) {
    return "Enrollment invitation admin operation is forbidden.";
  }
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID) {
    return "Enrollment invitation admin input is invalid.";
  }
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT) {
    return "Enrollment invitation admin operation has a state conflict.";
  }
  return "Enrollment invitation admin operation is unavailable.";
}

function safeCode(error) {
  return nullableText(error?.code, 100) || "UNEXPECTED_ERROR";
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  ENROLLMENT_INVITATION_ADMIN_ALLOWED_ROLES,
  ENROLLMENT_INVITATION_ADMIN_ERROR_CODES,
  ENROLLMENT_INVITATION_ADMIN_EVENTS,
  EnrollmentInvitationAdminApplicationError,
  EnrollmentInvitationAdminApplicationService,
  adminError,
  mapAdminError,
  readEnrollmentUnitId,
  toSafeInvitationDto,
};
