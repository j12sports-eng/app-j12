const {
  DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED,
} = require("../../domain/policies/digital-enrollment-document-completion.policy.js");

const DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE = "DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE";
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
  updateStudent: new Set([
    "birthCity",
    "birthDate",
    "birthState",
    "bloodType",
    "name",
    "nationality",
  ]),
});

class DigitalEnrollmentFormApplicationService {
  constructor({
    aggregateGateway = null,
    contractService = null,
    documentCompletionService = null,
    documentRequirementProvider = null,
    invitationResolver = null,
    logger = null,
  } = {}) {
    this.aggregateGateway = aggregateGateway;
    this.contractService = contractService;
    this.documentCompletionService = documentCompletionService;
    this.documentRequirementProvider = documentRequirementProvider;
    this.invitationResolver = invitationResolver;
    this.logger = logger;

    for (const operation of PUBLIC_OPERATIONS) this[operation] = this[operation].bind(this);
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
    const sanitizedCommand = sanitizeCommandEnvelope(operation, command);

    if (typeof this.invitationResolver?.resolveInvitationByRawToken !== "function") {
      this.auditBlocked(operation, "invitation_resolver_unavailable");
      throw blocked();
    }
    const invitation = await this.invitationResolver.resolveInvitationByRawToken({ rawToken });

    if (operation === "advanceStep" && sanitizedCommand.fields.targetStep === "REVIEW") {
      return this.evaluateReviewAttempt(invitation, sanitizedCommand);
    }

    if (typeof this.aggregateGateway?.executeDigitalEnrollmentOperation !== "function") {
      this.auditBlocked(operation, "canonical_aggregate_gateway_unavailable");
      throw blocked();
    }
    return this.aggregateGateway.executeDigitalEnrollmentOperation({
      command: sanitizedCommand,
      invitation,
      operation,
    });
  }

  async evaluateReviewAttempt(invitation, command) {
    if (typeof this.aggregateGateway?.inspectDigitalEnrollmentAdvance !== "function") {
      this.auditBlocked("advanceStep", "canonical_aggregate_inspection_unavailable");
      throw blocked();
    }
    const context = await this.aggregateGateway.inspectDigitalEnrollmentAdvance({
      command,
      invitation,
    });
    if (context.currentStep !== "DOCUMENTS" || context.revision !== command.revision) {
      throw invalidCommand("REVIEW requires the current DOCUMENTS revision.");
    }

    if (typeof this.documentRequirementProvider?.getRequiredDocumentTypes !== "function") {
      throw documentPolicyNotConfigured();
    }
    const requiredDocumentTypes = await this.documentRequirementProvider.getRequiredDocumentTypes({
      currentStep: context.currentStep,
      enrollmentId: context.enrollmentId,
      invitationId: invitation.invitationId,
      responsibleRelationshipId: context.responsibleRelationshipId,
      revision: context.revision,
    });
    if (!Array.isArray(requiredDocumentTypes)) throw documentPolicyNotConfigured();
    if (typeof this.documentCompletionService?.execute !== "function") {
      this.auditBlocked("advanceStep", "document_completion_service_unavailable");
      throw blocked();
    }
    const completion = await this.documentCompletionService.execute({
      enrollmentId: context.enrollmentId,
      requiredDocumentTypes,
      responsibleRelationshipId: context.responsibleRelationshipId,
    });
    if (!completion?.complete) throw documentsIncomplete();

    if (typeof this.contractService?.getContract !== "function") {
      this.auditBlocked("advanceStep", "digital_contract_service_unavailable");
      throw blocked();
    }
    return this.contractService.getContract();
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
  if (isWrite && (!Number.isSafeInteger(source.revision) || source.revision < 1))
    throw invalidCommand("revision is required.");
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
function documentPolicyNotConfigured() {
  const error = new Error("Digital enrollment document policy is not configured.");
  error.code = DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED;
  error.statusCode = 503;
  error.expose = false;
  return error;
}
function documentsIncomplete() {
  const error = new Error("Required digital enrollment documents are incomplete.");
  error.code = DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE;
  error.statusCode = 409;
  error.expose = true;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE,
  DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE,
  DigitalEnrollmentFormApplicationService,
  OPERATION_FIELD_ALLOWLISTS,
  PUBLIC_OPERATIONS,
  blocked,
  documentPolicyNotConfigured,
  documentsIncomplete,
  invalidCommand,
  sanitizeCommandEnvelope,
};
