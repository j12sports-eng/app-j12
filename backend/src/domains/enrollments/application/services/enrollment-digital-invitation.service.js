const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

const { EnrollmentStatus, normalizeEnrollmentStatus } = require("../../domain/enums/index.js");
const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../../domain/enums/enrollment-digital-invitation-status.enum.js");

const DEFAULT_INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_INVITATION_TTL_SECONDS = 5 * 60;
const MAX_INVITATION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RAW_TOKEN_BYTE_LENGTH = 32;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;

const ENROLLMENT_INVITATION_INVALID_INPUT_CODE = "ENROLLMENT_INVITATION_INVALID_INPUT";
const ENROLLMENT_INVITATION_FORBIDDEN_CODE = "ENROLLMENT_INVITATION_FORBIDDEN";
const ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE = "ENROLLMENT_INVITATION_NOT_AVAILABLE";
const ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE = "ENROLLMENT_INVITATION_ALREADY_ACTIVE";
const ENROLLMENT_INVITATION_EXPIRED_CODE = "ENROLLMENT_INVITATION_EXPIRED";
const ENROLLMENT_INVITATION_REVOKED_CODE = "ENROLLMENT_INVITATION_REVOKED";
const ENROLLMENT_INVITATION_STATE_CONFLICT_CODE = "ENROLLMENT_INVITATION_STATE_CONFLICT";
const ENROLLMENT_INVITATION_PERSISTENCE_ERROR_CODE = "ENROLLMENT_INVITATION_PERSISTENCE_ERROR";
const ENROLLMENT_INVITATION_COMMAND_FIELDS = new Set(["durationSeconds", "enrollmentId"]);
const ENROLLMENT_INVITATION_REVOKE_FIELDS = new Set(["invitationId"]);
const ENROLLMENT_INVITATION_RESOLVE_FIELDS = new Set(["rawToken"]);

class EnrollmentDigitalInvitationService {
  constructor({
    authorizeEnrollmentInvitation = null,
    clock = () => new Date(),
    defaultDurationSeconds = DEFAULT_INVITATION_TTL_SECONDS,
    enrollmentReader = null,
    invitationRepository = null,
    logger = null,
    tokenGenerator = generateRawToken,
  } = {}) {
    this.authorizeEnrollmentInvitation =
      typeof authorizeEnrollmentInvitation === "function" ? authorizeEnrollmentInvitation : null;
    this.clock = typeof clock === "function" ? clock : () => new Date();
    this.defaultDurationSeconds = normalizeDurationSeconds(defaultDurationSeconds, {
      allowDefault: true,
    });
    this.enrollmentReader = enrollmentReader;
    this.invitationRepository = invitationRepository;
    this.logger = logger;
    this.tokenGenerator = typeof tokenGenerator === "function" ? tokenGenerator : generateRawToken;
  }

  async createInvitation(command = {}, context = {}) {
    const startedAt = this.nowDate();
    const safeCommand = readObject(command);
    const unexpectedFields = unexpectedKeys(safeCommand, ENROLLMENT_INVITATION_COMMAND_FIELDS);
    const enrollmentId = nullableText(safeCommand.enrollmentId, 64);
    const contextData = this.readTrustedContext(context);
    const durationSeconds = normalizeDurationSeconds(
      safeCommand.durationSeconds ?? this.defaultDurationSeconds,
    );

    this.logAudit("ENROLLMENT_INVITATION_CREATE_STARTED", {
      actorId: contextData.actorId,
      enrollmentId,
      unitId: contextData.unitId,
    });

    try {
      if (unexpectedFields.length > 0) {
        throw controlledError(
          "createInvitation accepts only enrollmentId and durationSeconds.",
          ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
          { unexpectedFields },
        );
      }
      if (!enrollmentId || !contextData.actorId || !contextData.unitId) {
        throw controlledError(
          "createInvitation requires enrollmentId, actorId and trusted unitId.",
          ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
          {
            hasActorId: Boolean(contextData.actorId),
            hasEnrollmentId: Boolean(enrollmentId),
            hasUnitId: Boolean(contextData.unitId),
          },
        );
      }

      await this.assertAuthorized({
        actorId: contextData.actorId,
        authorization: contextData.authorization,
        enrollmentId,
        operation: "createInvitation",
        unitId: contextData.unitId,
      });
      const enrollment = await this.findDraftEnrollment(enrollmentId, contextData.unitId);
      await this.assertNoActiveInvitation(enrollmentId, startedAt);

      const rawToken = this.createRawToken();
      const invitation = await this.createPersistedInvitation({
        createdBy: contextData.actorId,
        enrollmentId,
        expiresAt: toMysqlDateTime(addSeconds(startedAt, durationSeconds)),
        metadata: compactObject({
          correlationId: contextData.correlationId,
          requestId: contextData.requestId,
        }),
        tokenHash: hashRawToken(rawToken),
        unitId: contextData.unitId,
      });
      const dto = toInvitationResultDto(invitation, { rawToken });

      this.logAudit("ENROLLMENT_INVITATION_CREATED", {
        actorId: contextData.actorId,
        enrollmentId,
        invitationId: dto.invitationId,
        result: "created",
        unitId: contextData.unitId,
      });

      return Object.freeze({ ...dto, enrollment: toInternalEnrollmentDto(enrollment) });
    } catch (error) {
      this.logAudit("ENROLLMENT_INVITATION_REJECTED", {
        actorId: contextData.actorId,
        code: nullableText(readProperty(error, "code"), 96) || "UNEXPECTED_ERROR",
        enrollmentId,
        unitId: contextData.unitId,
      });
      throw this.mapUnexpectedError(error);
    }
  }

  async revokeInvitation(command = {}, context = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = unexpectedKeys(safeCommand, ENROLLMENT_INVITATION_REVOKE_FIELDS);
    const invitationId = nullableText(safeCommand.invitationId, 64);
    const contextData = this.readTrustedContext(context);

    if (
      unexpectedFields.length > 0 ||
      !invitationId ||
      !contextData.actorId ||
      !contextData.unitId
    ) {
      throw controlledError(
        "revokeInvitation requires invitationId, actorId and unitId.",
        ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
        {
          hasActorId: Boolean(contextData.actorId),
          hasInvitationId: Boolean(invitationId),
          hasUnitId: Boolean(contextData.unitId),
          unexpectedFields,
        },
      );
    }

    const repository = this.getInvitationRepository();
    const current = await repository.findById(invitationId);

    if (!current) {
      return Object.freeze({
        changed: false,
        invitationId,
        status: EnrollmentDigitalInvitationStatus.REVOKED,
      });
    }

    await this.assertAuthorized({
      actorId: contextData.actorId,
      authorization: contextData.authorization,
      enrollmentId: readProperty(current, "enrollmentId"),
      invitationId,
      operation: "revokeInvitation",
      unitId: contextData.unitId,
    });
    this.assertUnitMatches(current, contextData.unitId);

    if (
      normalizeEnrollmentDigitalInvitationStatus(readProperty(current, "status")) ===
      EnrollmentDigitalInvitationStatus.REVOKED
    ) {
      return Object.freeze({
        changed: false,
        invitationId,
        status: EnrollmentDigitalInvitationStatus.REVOKED,
      });
    }

    const result = await repository.revokeInvitation({
      invitationId,
      revokedAt: this.nowSql(),
      revokedBy: contextData.actorId,
    });
    const invitation = result.invitation || (await repository.findById(invitationId));

    this.logAudit("ENROLLMENT_INVITATION_REVOKED", {
      actorId: contextData.actorId,
      enrollmentId: readProperty(current, "enrollmentId"),
      invitationId,
      result: result.changed ? "revoked" : "already_revoked",
      unitId: contextData.unitId,
    });

    return Object.freeze({
      changed: Boolean(result.changed),
      invitationId,
      status:
        normalizeEnrollmentDigitalInvitationStatus(readProperty(invitation, "status")) ||
        EnrollmentDigitalInvitationStatus.REVOKED,
    });
  }

  async renewInvitation(command = {}, context = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = unexpectedKeys(safeCommand, ENROLLMENT_INVITATION_COMMAND_FIELDS);
    const enrollmentId = nullableText(safeCommand.enrollmentId, 64);
    const contextData = this.readTrustedContext(context);
    const durationSeconds = normalizeDurationSeconds(
      safeCommand.durationSeconds ?? this.defaultDurationSeconds,
    );

    if (
      unexpectedFields.length > 0 ||
      !enrollmentId ||
      !contextData.actorId ||
      !contextData.unitId
    ) {
      throw controlledError(
        "renewInvitation requires enrollmentId, actorId and unitId.",
        ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
        {
          hasActorId: Boolean(contextData.actorId),
          hasEnrollmentId: Boolean(enrollmentId),
          hasUnitId: Boolean(contextData.unitId),
          unexpectedFields,
        },
      );
    }

    await this.assertAuthorized({
      actorId: contextData.actorId,
      authorization: contextData.authorization,
      enrollmentId,
      operation: "renewInvitation",
      unitId: contextData.unitId,
    });
    await this.findDraftEnrollment(enrollmentId, contextData.unitId);

    const repository = this.getInvitationRepository();
    const previous = await repository.findActiveByEnrollment(enrollmentId);
    const rawToken = this.createRawToken();
    const replacement = {
      createdBy: contextData.actorId,
      enrollmentId,
      expiresAt: toMysqlDateTime(addSeconds(this.nowDate(), durationSeconds)),
      metadata: compactObject({
        correlationId: contextData.correlationId,
        requestId: contextData.requestId,
      }),
      tokenHash: hashRawToken(rawToken),
      unitId: contextData.unitId,
    };
    let result;

    try {
      if (typeof repository.replaceInvitation === "function" && previous) {
        result = await repository.replaceInvitation({
          currentInvitationId: readProperty(previous, "id"),
          replacement,
          revokedAt: this.nowSql(),
          revokedBy: contextData.actorId,
        });
      } else {
        if (previous) {
          await repository.revokeInvitation({
            invitationId: readProperty(previous, "id"),
            replacedByInvitationId: null,
            revokedAt: this.nowSql(),
            revokedBy: contextData.actorId,
          });
        }
        result = {
          invitation: await this.createPersistedInvitation(replacement),
          previousInvitation: previous,
          renewed: true,
        };
      }
    } catch (error) {
      throw this.mapUnexpectedError(error);
    }

    const invitation = result.invitation;
    const dto = toInvitationResultDto(invitation, { rawToken });

    this.logAudit("ENROLLMENT_INVITATION_RENEWED", {
      actorId: contextData.actorId,
      enrollmentId,
      invitationId: dto.invitationId,
      previousInvitationId: nullableText(readProperty(result.previousInvitation, "id"), 64),
      result: "renewed",
      unitId: contextData.unitId,
    });

    return Object.freeze(dto);
  }

  async resolveInvitationByRawToken(command = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = unexpectedKeys(safeCommand, ENROLLMENT_INVITATION_RESOLVE_FIELDS);
    const rawToken = nullableText(safeCommand.rawToken, 256);

    if (unexpectedFields.length > 0 || !isValidRawToken(rawToken)) {
      throw genericNotAvailable();
    }

    const tokenHash = hashRawToken(rawToken);
    const repository = this.getInvitationRepository();
    const invitation = await repository.findByTokenHash(tokenHash);

    if (!invitation) throw genericNotAvailable();

    const status = normalizeEnrollmentDigitalInvitationStatus(readProperty(invitation, "status"));
    if (status === EnrollmentDigitalInvitationStatus.REVOKED) throw genericNotAvailable();
    if (status !== EnrollmentDigitalInvitationStatus.ACTIVE) throw genericNotAvailable();
    if (isExpired(readProperty(invitation, "expiresAt"), this.nowDate())) {
      // Public resolution is deliberately read-only; maintenance owns expiry persistence.
      throw genericNotAvailable();
    }

    const enrollment = await this.findDraftEnrollment(
      readProperty(invitation, "enrollmentId"),
      readProperty(invitation, "unitId"),
    );

    this.logAudit("ENROLLMENT_INVITATION_RESOLVED", {
      enrollmentId: readProperty(invitation, "enrollmentId"),
      invitationId: readProperty(invitation, "id"),
      result: "resolved",
      unitId: readProperty(invitation, "unitId"),
    });

    return Object.freeze({
      enrollment: toInternalEnrollmentDto(enrollment),
      enrollmentId: readProperty(invitation, "enrollmentId"),
      expiresAt: readProperty(invitation, "expiresAt"),
      invitationId: readProperty(invitation, "id"),
      status: EnrollmentDigitalInvitationStatus.ACTIVE,
      unitId: readProperty(invitation, "unitId"),
    });
  }

  async markInvitationUsed(command = {}, context = {}) {
    const invitationId = nullableText(readProperty(command, "invitationId"), 64);
    const contextData = this.readTrustedContext(context);
    if (!invitationId || !contextData.actorId) {
      throw controlledError(
        "markInvitationUsed requires invitationId and actorId.",
        ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
      );
    }
    if (typeof this.getInvitationRepository().markUsed !== "function") {
      throw controlledError(
        "Invitation usage persistence is not available.",
        ENROLLMENT_INVITATION_STATE_CONFLICT_CODE,
      );
    }
    return this.getInvitationRepository().markUsed({
      invitationId,
      usedAt: this.nowSql(),
      usedBy: contextData.actorId,
    });
  }

  async assertNoActiveInvitation(enrollmentId, now) {
    const repository = this.getInvitationRepository();
    const active = await repository.findActiveByEnrollment(enrollmentId);
    if (!active) return;

    if (isExpired(readProperty(active, "expiresAt"), now)) {
      if (typeof repository.expireInvitation === "function") {
        await repository.expireInvitation({
          expiredAt: toMysqlDateTime(now),
          invitationId: readProperty(active, "id"),
        });
        return;
      }
    }

    throw controlledError(
      "Enrollment already has an active invitation.",
      ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE,
      {
        enrollmentId,
        invitationId: readProperty(active, "id"),
      },
    );
  }

  async createPersistedInvitation(input) {
    try {
      return await this.getInvitationRepository().create(input);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw controlledError(
          "Enrollment already has an active invitation.",
          ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE,
          {
            enrollmentId: input.enrollmentId,
          },
        );
      }
      throw error;
    }
  }

  async findDraftEnrollment(enrollmentId, unitId) {
    const enrollment = await this.readEnrollment(enrollmentId);
    if (!enrollment) {
      throw controlledError(
        "Enrollment invitation is not available.",
        ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
        { enrollmentId },
      );
    }
    const status = normalizeEnrollmentStatus(readProperty(enrollment, "status"));
    if (status !== EnrollmentStatus.DRAFT) {
      throw controlledError(
        "Enrollment must remain DRAFT for invitation use.",
        ENROLLMENT_INVITATION_STATE_CONFLICT_CODE,
        {
          enrollmentId,
          status,
        },
      );
    }
    this.assertUnitMatches(enrollment, unitId);
    return enrollment;
  }

  assertUnitMatches(record, unitId) {
    const recordUnitId = nullableText(
      readProperty(record, "unitId") ?? readProperty(record, "unit_id"),
      64,
    );
    if (!recordUnitId || !unitId || recordUnitId !== unitId) {
      throw controlledError(
        "Enrollment invitation unit scope does not match.",
        ENROLLMENT_INVITATION_FORBIDDEN_CODE,
        {
          unitMatches: false,
        },
      );
    }
  }

  async readEnrollment(enrollmentId) {
    if (typeof this.enrollmentReader?.findEnrollmentById === "function") {
      return this.enrollmentReader.findEnrollmentById(enrollmentId);
    }
    if (typeof this.enrollmentReader?.findById === "function") {
      return this.enrollmentReader.findById(enrollmentId);
    }
    throw new TypeError("EnrollmentDigitalInvitationService requires an enrollmentReader.");
  }

  async assertAuthorized(input) {
    if (!this.authorizeEnrollmentInvitation) {
      throw controlledError(
        "Enrollment invitation authorization is not configured.",
        ENROLLMENT_INVITATION_FORBIDDEN_CODE,
      );
    }
    try {
      const authorized = await this.authorizeEnrollmentInvitation(Object.freeze({ ...input }));
      if (authorized === true) return;
    } catch {
      throw controlledError(
        "Enrollment invitation authorization failed closed.",
        ENROLLMENT_INVITATION_FORBIDDEN_CODE,
      );
    }
    throw controlledError(
      "Actor is not authorized for Enrollment invitation.",
      ENROLLMENT_INVITATION_FORBIDDEN_CODE,
    );
  }

  readTrustedContext(context = {}) {
    const source = readObject(context);
    return {
      actorId: nullableText(source.actorId ?? source.userId, 191),
      authorization: readProperty(source, "authorization"),
      correlationId: nullableText(source.correlationId, 191),
      requestId: nullableText(source.requestId, 191),
      unitId: nullableText(source.unitId, 64),
    };
  }

  createRawToken() {
    const token = this.tokenGenerator();
    if (!isValidRawToken(token)) {
      throw controlledError(
        "Generated invitation token is invalid.",
        ENROLLMENT_INVITATION_PERSISTENCE_ERROR_CODE,
      );
    }
    return token;
  }

  getInvitationRepository() {
    if (!this.invitationRepository || typeof this.invitationRepository.create !== "function") {
      throw new TypeError("EnrollmentDigitalInvitationService requires an invitationRepository.");
    }
    return this.invitationRepository;
  }

  nowDate() {
    const value = this.clock();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  nowSql() {
    return toMysqlDateTime(this.nowDate());
  }

  mapUnexpectedError(error) {
    if (isControlledError(error)) return error;
    return controlledError(
      "Enrollment invitation persistence failed.",
      ENROLLMENT_INVITATION_PERSISTENCE_ERROR_CODE,
    );
  }

  logAudit(action, context = {}) {
    const safe = compactObject(context);
    delete safe.rawToken;
    delete safe.token;
    delete safe.tokenHash;
    const logger = this.logger;
    const method = typeof logger?.info === "function" ? logger.info.bind(logger) : null;
    method?.("[enrollments] digital invitation audit", { ...safe, action });
  }
}

function generateRawToken() {
  return randomBytes(RAW_TOKEN_BYTE_LENGTH).toString("base64url");
}

function hashRawToken(rawToken) {
  const normalized = nullableText(rawToken, 256);
  if (!isValidRawToken(normalized)) {
    throw controlledError("Invalid invitation token.", ENROLLMENT_INVITATION_INVALID_INPUT_CODE);
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function compareTokenHashes(left, right) {
  const a = Buffer.from(String(left ?? ""), "hex");
  const b = Buffer.from(String(right ?? ""), "hex");
  return a.length === b.length && a.length === 32 && timingSafeEqual(a, b);
}

function isValidRawToken(value) {
  return RAW_TOKEN_PATTERN.test(String(value ?? ""));
}

function genericNotAvailable(code = ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE, details = {}) {
  return controlledError("Enrollment invitation is not available.", code, details);
}

function toInvitationResultDto(invitation, { rawToken = null } = {}) {
  return Object.freeze({
    createdAt: readProperty(invitation, "createdAt"),
    enrollmentId: readProperty(invitation, "enrollmentId"),
    expiresAt: readProperty(invitation, "expiresAt"),
    invitationId: readProperty(invitation, "id"),
    rawToken,
    status: normalizeEnrollmentDigitalInvitationStatus(readProperty(invitation, "status")),
    unitId: readProperty(invitation, "unitId"),
  });
}

function toInternalEnrollmentDto(enrollment) {
  return Object.freeze({
    enrollmentId: readProperty(enrollment, "id"),
    status: normalizeEnrollmentStatus(readProperty(enrollment, "status")),
    unitId: readProperty(enrollment, "unitId") ?? readProperty(enrollment, "unit_id"),
  });
}

function normalizeDurationSeconds(value, { allowDefault = false } = {}) {
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_INVITATION_TTL_SECONDS ||
    parsed > MAX_INVITATION_TTL_SECONDS
  ) {
    if (allowDefault) return DEFAULT_INVITATION_TTL_SECONDS;
    throw controlledError(
      "Invalid invitation duration.",
      ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
      {
        maxSeconds: MAX_INVITATION_TTL_SECONDS,
        minSeconds: MIN_INVITATION_TTL_SECONDS,
      },
    );
  }
  return Math.trunc(parsed);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function isExpired(expiresAt, now) {
  return new Date(expiresAt).getTime() <= new Date(now).getTime();
}

function toMysqlDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function unexpectedKeys(input, allowed) {
  return Object.keys(readObject(input)).filter((key) => !allowed.has(key));
}

function isDuplicateEntry(error) {
  return error?.code === "ER_DUP_ENTRY" || Number(error?.errno) === 1062;
}

function isControlledError(error) {
  return Boolean(error && typeof error === "object" && nullableText(error.code, 128));
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readProperty(value, property) {
  return value && typeof value === "object" ? (value[property] ?? null) : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""),
  );
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  for (const [key, value] of Object.entries(details)) error[key] = value;
  return error;
}

module.exports = {
  DEFAULT_INVITATION_TTL_SECONDS,
  ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE,
  ENROLLMENT_INVITATION_EXPIRED_CODE,
  ENROLLMENT_INVITATION_FORBIDDEN_CODE,
  ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
  ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  ENROLLMENT_INVITATION_PERSISTENCE_ERROR_CODE,
  ENROLLMENT_INVITATION_REVOKED_CODE,
  ENROLLMENT_INVITATION_STATE_CONFLICT_CODE,
  EnrollmentDigitalInvitationService,
  MAX_INVITATION_TTL_SECONDS,
  MIN_INVITATION_TTL_SECONDS,
  RAW_TOKEN_BYTE_LENGTH,
  RAW_TOKEN_PATTERN,
  TOKEN_HASH_PATTERN,
  compareTokenHashes,
  generateRawToken,
  hashRawToken,
  isValidRawToken,
};
