const {
  ENROLLMENT_INVITATION_ADMIN_ERROR_CODES,
} = require("../../application/services/enrollment-invitation-admin-application.service.js");

const ADMIN_INVITATION_ERROR_STATUS = Object.freeze({
  [ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN]: 403,
  [ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID]: 400,
  [ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE]: 404,
  [ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR]: 500,
  [ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT]: 409,
});

const BODY_FIELDS_BY_ACTION = Object.freeze({
  create: new Set(["durationSeconds", "expiresInSeconds"]),
  getCurrent: new Set(),
  renew: new Set(["durationSeconds", "expiresInSeconds"]),
  revoke: new Set(),
});

class EnrollmentInvitationAdminController {
  constructor({ invitationAdminService = null, logger = null } = {}) {
    this.invitationAdminService = invitationAdminService;
    this.logger = logger;

    this.create = this.create.bind(this);
    this.renew = this.renew.bind(this);
    this.revoke = this.revoke.bind(this);
    this.getCurrent = this.getCurrent.bind(this);
  }

  async create(req, res, next) {
    return this.handle(req, res, next, "create", 201);
  }

  async renew(req, res, next) {
    return this.handle(req, res, next, "renew", 200);
  }

  async revoke(req, res, next) {
    return this.handle(req, res, next, "revoke", 200);
  }

  async getCurrent(req, res, next) {
    return this.handle(req, res, next, "getCurrent", 200);
  }

  async handle(req, res, next, action, successStatusCode) {
    try {
      const input = readRequestInput(req, action);
      const result = await this.getService()[action](input, {
        actorContext: req?.actorContext,
      });
      return res.status(successStatusCode).json(successEnvelope(result));
    } catch (error) {
      return handleInvitationAdminError(error, res, next);
    }
  }

  getService() {
    const service = this.invitationAdminService;
    if (
      !service ||
      typeof service.create !== "function" ||
      typeof service.renew !== "function" ||
      typeof service.revoke !== "function" ||
      typeof service.getCurrent !== "function"
    ) {
      throw new TypeError("EnrollmentInvitationAdminController requires invitationAdminService.");
    }
    return service;
  }
}

function readRequestInput(req = {}, action) {
  const params = readObject(req.params);
  const body = readObject(req.body);
  const allowedBodyFields = BODY_FIELDS_BY_ACTION[action] || new Set();
  const unexpectedBodyFields = Object.keys(body).filter((field) => !allowedBodyFields.has(field));

  if (unexpectedBodyFields.length > 0) {
    throw controllerError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }

  const enrollmentId = readEnrollmentId(params.enrollmentId ?? params.id);
  const command = { enrollmentId };
  const durationSeconds = readDurationSeconds(body);

  if (durationSeconds != null) {
    command.durationSeconds = durationSeconds;
  }

  return command;
}

function readEnrollmentId(value) {
  const enrollmentId = nullableText(value, 64);
  if (!enrollmentId || !/^[A-Za-z0-9._:-]{1,64}$/.test(enrollmentId)) {
    throw controllerError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }
  return enrollmentId;
}

function readDurationSeconds(body = {}) {
  const hasDurationSeconds = body.durationSeconds != null;
  const hasExpiresInSeconds = body.expiresInSeconds != null;

  if (!hasDurationSeconds && !hasExpiresInSeconds) return null;
  if (hasDurationSeconds && hasExpiresInSeconds) {
    throw controllerError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }

  const parsed = Number(hasDurationSeconds ? body.durationSeconds : body.expiresInSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw controllerError(ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID, 400);
  }
  return Math.trunc(parsed);
}

function successEnvelope(data) {
  return {
    data: sanitizeResponse(data),
    success: true,
  };
}

function sanitizeResponse(value) {
  if (Array.isArray(value)) return value.map(sanitizeResponse);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "tokenHash" || key === "hash") continue;
    if (key === "rawToken") {
      output.rawToken = nullableText(item, 256);
      continue;
    }
    output[key] = sanitizeResponse(item);
  }
  return output;
}

function handleInvitationAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);
  if (!code || !ADMIN_INVITATION_ERROR_STATUS[code]) {
    return next(error);
  }

  const statusCode = ADMIN_INVITATION_ERROR_STATUS[code];
  return res.status(statusCode).json({
    code,
    error: statusCode >= 500
      ? "Enrollment invitation admin operation is unavailable."
      : publicErrorMessage(code),
    success: false,
  });
}

function publicErrorMessage(code) {
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID) {
    return "Enrollment invitation admin input is invalid.";
  }
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN) {
    return "Enrollment invitation admin operation is forbidden.";
  }
  if (code === ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT) {
    return "Enrollment invitation admin operation has a state conflict.";
  }
  return "Enrollment invitation admin operation is unavailable.";
}

function controllerError(code, statusCode) {
  const error = new Error(publicErrorMessage(code));
  error.code = code;
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  ADMIN_INVITATION_ERROR_STATUS,
  EnrollmentInvitationAdminController,
  handleInvitationAdminError,
  readRequestInput,
  successEnvelope,
};
