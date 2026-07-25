const DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE = "DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED";
const PUBLIC_OPERATIONS = Object.freeze([
  "getForm",
  "updateResponsible",
  "updateStudent",
  "updateAddress",
  "updateAdditionalInformation",
  "advanceStep",
  "getReview",
]);
const OPERATION_FIELD_ALLOWLISTS = Object.freeze({
  advanceStep: new Set(["targetStep"]),
  getForm: new Set(),
  getReview: new Set(),
  updateAdditionalInformation: new Set(),
  updateAddress: new Set([
    "city",
    "complement",
    "district",
    "number",
    "zipCode",
    "state",
    "street",
  ]),
  updateResponsible: new Set(["email", "name", "phone"]),
  updateStudent: new Set(["birthDate", "name"]),
});

/**
 * Fail-closed application boundary for the resumable digital enrollment flow.
 *
 * Sprint 29.1E cannot safely write until a canonical aggregate gateway can
 * resolve the responsible relationship and persist progress transactionally
 * with optimistic concurrency. No HTTP route mounts this foundation.
 */
class DigitalEnrollmentFormApplicationService {
  constructor({ aggregateGateway = null, invitationResolver = null, logger = null } = {}) {
    this.aggregateGateway = aggregateGateway;
    this.invitationResolver = invitationResolver;
    this.logger = logger;

    for (const operation of PUBLIC_OPERATIONS) {
      this[operation] = this[operation].bind(this);
    }
  }

  async getForm(rawToken) {
    return this.execute("getForm", rawToken);
  }

  async updateResponsible(rawToken, command = {}) {
    return this.execute("updateResponsible", rawToken, command);
  }

  async updateStudent(rawToken, command = {}) {
    return this.execute("updateStudent", rawToken, command);
  }

  async updateAddress(rawToken, command = {}) {
    return this.execute("updateAddress", rawToken, command);
  }

  async updateAdditionalInformation(rawToken, command = {}) {
    return this.execute("updateAdditionalInformation", rawToken, command);
  }

  async advanceStep(rawToken, command = {}) {
    return this.execute("advanceStep", rawToken, command);
  }

  async getReview(rawToken) {
    return this.execute("getReview", rawToken);
  }

  async execute(operation, rawToken, command = {}) {
    if (!PUBLIC_OPERATIONS.includes(operation)) throw blocked();

    if (
      !this.invitationResolver ||
      typeof this.invitationResolver.resolveInvitationByRawToken !== "function"
    ) {
      this.auditBlocked(operation, "invitation_resolver_unavailable");
      throw blocked();
    }

    // Revalidation deliberately happens before consulting the unavailable
    // aggregate boundary. The raw token is never forwarded to logs or storage.
    const invitation = await this.invitationResolver.resolveInvitationByRawToken({ rawToken });

    if (
      !this.aggregateGateway ||
      typeof this.aggregateGateway.executeDigitalEnrollmentOperation !== "function"
    ) {
      this.auditBlocked(operation, "canonical_aggregate_gateway_unavailable");
      throw blocked();
    }

    return this.aggregateGateway.executeDigitalEnrollmentOperation({
      command: sanitizeCommandEnvelope(operation, command),
      invitation,
      operation,
    });
  }

  auditBlocked(operation, reason) {
    this.logger?.warn?.("[enrollments] digital enrollment foundation blocked", {
      operation,
      reason,
      result: "blocked",
    });
  }
}

function sanitizeCommandEnvelope(operation, command) {
  const source = command && typeof command === "object" && !Array.isArray(command) ? command : {};
  const sourceFields =
    source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
      ? source.fields
      : {};
  const allowlist = OPERATION_FIELD_ALLOWLISTS[operation] || new Set();
  const unexpectedFields = Object.keys(sourceFields).filter((field) => !allowlist.has(field));
  if (unexpectedFields.length > 0) throw blocked();
  const isWrite = !new Set(["getForm", "getReview"]).has(operation);
  if (isWrite && (!Number.isSafeInteger(source.revision) || source.revision < 1)) {
    throw invalidCommand("revision is required.");
  }
  return Object.freeze({
    fields: Object.freeze(
      Object.fromEntries(Object.entries(sourceFields).filter(([field]) => allowlist.has(field))),
    ),
    revision: Number.isSafeInteger(source.revision) ? source.revision : null,
  });
}

function invalidCommand(message) {
  const error = new Error(message);
  error.code = "DIGITAL_ENROLLMENT_INVALID_COMMAND";
  error.statusCode = 400;
  error.expose = true;
  return error;
}

function blocked() {
  const error = new Error("Digital enrollment form is not available.");
  error.code = DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE;
  error.statusCode = 503;
  error.expose = false;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE,
  DigitalEnrollmentFormApplicationService,
  OPERATION_FIELD_ALLOWLISTS,
  PUBLIC_OPERATIONS,
  blocked,
  invalidCommand,
  sanitizeCommandEnvelope,
};
