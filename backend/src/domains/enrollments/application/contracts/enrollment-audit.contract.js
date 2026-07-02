const ENROLLMENT_AUDIT_CONTRACT_VERSION = "sprint-9.58";
const ENROLLMENT_AUDIT_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_AUDIT_INPUT_REQUIRED_CODE = "ENROLLMENT_AUDIT_INPUT_REQUIRED";
const ENROLLMENT_AUDIT_INVALID_ACTION_CODE = "ENROLLMENT_AUDIT_INVALID_ACTION";
const ENROLLMENT_AUDIT_PERSISTENCE_BLOCKED_BY_SCHEMA_OR_PATTERN_GAP_CODE =
  "AUDIT_PERSISTENCE_BLOCKED_BY_SCHEMA_OR_PATTERN_GAP";

const EnrollmentAuditAction = Object.freeze({
  ACTIVE_ENROLLMENT_FOUND: "ACTIVE_ENROLLMENT_FOUND",
  CLASS_LINK_PREPARED: "CLASS_LINK_PREPARED",
  CONFLICT_DETECTED: "CONFLICT_DETECTED",
  DRAFT_CONFIRMED: "DRAFT_CONFIRMED",
  DRAFT_CONFIRMATION_BLOCKED: "DRAFT_CONFIRMATION_BLOCKED",
  DRAFT_CONFIRMATION_STARTED: "DRAFT_CONFIRMATION_STARTED",
  DRAFT_CREATED: "DRAFT_CREATED",
  DRAFT_CREATION_BLOCKED: "DRAFT_CREATION_BLOCKED",
  DRAFT_REUSED: "DRAFT_REUSED",
  DUPLICATE_DRAFT_BLOCKED: "DUPLICATE_DRAFT_BLOCKED",
  FINANCIAL_LINK_PREPARED: "FINANCIAL_LINK_PREPARED",
  NOTIFICATION_PREPARED: "NOTIFICATION_PREPARED",
  SCHEDULE_LINK_PREPARED: "SCHEDULE_LINK_PREPARED",
});

const ENROLLMENT_AUDIT_ACTIONS = Object.freeze(Object.values(EnrollmentAuditAction));

const PROHIBITED_METADATA_PATTERNS = Object.freeze([
  /authorization/i,
  /card/i,
  /cartao/i,
  /cnpj/i,
  /cpf/i,
  /document/i,
  /documento/i,
  /financeiro/i,
  /password/i,
  /pagamento/i,
  /rg/i,
  /secret/i,
  /senha/i,
  /stack/i,
  /token/i,
  /valor/i,
]);

/**
 * Prepares a safe audit event payload for Enrollment operations.
 *
 * This contract does not persist anything. It defines the minimum payload,
 * masks unsafe metadata and documents why real audit storage is still blocked.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {string|null} [input.action]
 * @param {string|Record<string, unknown>|null} [input.actor]
 * @param {string|null} [input.occurredAt]
 * @param {string|null} [input.requestId]
 * @param {string|null} [input.correlationId]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function recordEnrollmentAuditEvent(input = {}) {
  const action = normalizeAction(input.action);
  const actor = normalizeActor(input.actor ?? input.requestedBy ?? input.confirmedBy);
  const enrollmentId = nullableText(input.enrollmentId ?? input.enrollment_id, 64);
  const studentPersonId = nullableText(input.studentPersonId ?? input.student_person_id, 64);
  const studentProfileId = nullableText(input.studentProfileId ?? input.student_profile_id, 64);
  const correlationId = nullableText(
    input.correlationId ?? input.requestId ?? input.metadata?.correlationId ?? input.metadata?.requestId,
    100,
  );
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const metadata = sanitizeMetadata(input.metadata);

  if (!action || !actor) {
    throw controlledError(
      "recordEnrollmentAuditEvent requires action and actor.",
      ENROLLMENT_AUDIT_INPUT_REQUIRED_CODE,
      {
        hasAction: Boolean(action),
        hasActor: Boolean(actor),
      },
    );
  }

  if (!ENROLLMENT_AUDIT_ACTIONS.includes(action)) {
    throw controlledError(
      "recordEnrollmentAuditEvent received an unsupported action.",
      ENROLLMENT_AUDIT_INVALID_ACTION_CODE,
      {
        action,
        allowedActions: [...ENROLLMENT_AUDIT_ACTIONS],
      },
    );
  }

  const minimalPayload = {
    action,
    actor,
    correlationId,
    enrollmentId,
    occurredAt,
    studentPersonId,
    studentProfileId,
  };

  return {
    ...minimalPayload,
    auditEventName: `enrollments.audit.${action.toLowerCase()}`,
    auditFailureCorruptsEnrollment: false,
    auditPayloadSafe: true,
    auditPersistenceEnabled: false,
    auditTableCreated: false,
    blockedBySchemaOrPatternGap: true,
    blockerCode: ENROLLMENT_AUDIT_PERSISTENCE_BLOCKED_BY_SCHEMA_OR_PATTERN_GAP_CODE,
    contractDocumented: true,
    contractVersion: ENROLLMENT_AUDIT_CONTRACT_VERSION,
    failureTolerant: true,
    futureAuditTable: {
      required: true,
      suggestedColumns: [
        "id",
        "enrollment_id",
        "student_person_id",
        "student_profile_id",
        "action",
        "actor",
        "correlation_id",
        "metadata_json",
        "occurred_at",
        "created_at",
      ],
      suggestedIndexes: ["enrollment_id", "student_profile_id", "action", "occurred_at"],
      tableName: "enrollment_audit_events",
    },
    futureRequirements: [
      "define retention policy before persistence",
      "create a dedicated audit table or shared audit module",
      "propagate requestId/correlationId from HTTP boundaries into facade calls",
      "persist only sanitized metadata and minimal identifiers",
      "keep audit failures non-blocking for already completed enrollment state changes",
    ],
    logPayload: {
      ...minimalPayload,
      metadata,
    },
    metadata,
    noAuditTableCreated: true,
    noPersonalDataSnapshotStored: true,
    persisted: false,
    prepared: true,
    prohibitedMetadataPatterns: PROHIBITED_METADATA_PATTERNS.map((pattern) => pattern.source),
    status: ENROLLMENT_AUDIT_PREPARED_STATUS,
  };
}

/**
 * Backward-compatible preparation name for callers that should not imply real
 * persistence.
 *
 * @param {Object} input
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentAuditEvent(input = {}) {
  return recordEnrollmentAuditEvent(input);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeAction(value) {
  return nullableText(value, 64)?.toUpperCase() ?? null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeActor(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return nullableText(
      value.id ?? value.userId ?? value.email ?? value.login ?? value.name ?? value.nome,
      191,
    );
  }

  return nullableText(value, 191);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOccurredAt(value) {
  const normalized = nullableText(value, 32);

  if (!normalized) {
    return new Date().toISOString();
  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? normalized : date.toISOString();
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function sanitizeMetadata(value = {}) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sanitized = {};

  for (const [key, item] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey || isProhibitedMetadataKey(normalizedKey)) {
      continue;
    }

    if (item === null || typeof item === "boolean" || typeof item === "number") {
      sanitized[normalizedKey] = item;
      continue;
    }

    if (typeof item === "string") {
      sanitized[normalizedKey] = nullableText(item, 191);
    }
  }

  return {
    ...sanitized,
    preparedOnly: true,
    sensitiveDataRemoved: true,
  };
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isProhibitedMetadataKey(key) {
  return PROHIBITED_METADATA_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

/**
 * @param {string} message
 * @param {string} code
 * @param {Record<string, unknown>} [details]
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  ENROLLMENT_AUDIT_ACTIONS,
  ENROLLMENT_AUDIT_CONTRACT_VERSION,
  ENROLLMENT_AUDIT_INPUT_REQUIRED_CODE,
  ENROLLMENT_AUDIT_INVALID_ACTION_CODE,
  ENROLLMENT_AUDIT_PERSISTENCE_BLOCKED_BY_SCHEMA_OR_PATTERN_GAP_CODE,
  ENROLLMENT_AUDIT_PREPARED_STATUS,
  EnrollmentAuditAction,
  PROHIBITED_METADATA_PATTERNS,
  prepareEnrollmentAuditEvent,
  recordEnrollmentAuditEvent,
};
