const ENROLLMENT_NOTIFICATION_INPUT_REQUIRED_CODE = "ENROLLMENT_NOTIFICATION_INPUT_REQUIRED";
const ENROLLMENT_NOTIFICATION_INVALID_EVENT_TYPE_CODE = "ENROLLMENT_NOTIFICATION_INVALID_EVENT_TYPE";
const ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS_CODE =
  "ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_NOTIFICATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE =
  "NOTIFICATION_CREATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP";
const ENROLLMENT_NOTIFICATION_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_NOTIFICATION_CONTRACT_VERSION = "sprint-9.53";
const REQUIRED_NOTIFICATION_LINK_TABLE = "enrollment_notification_links";

const EnrollmentNotificationEventType = Object.freeze({
  ENROLLMENT_CLASS_LINKED: "ENROLLMENT_CLASS_LINKED",
  ENROLLMENT_CONFIRMED: "ENROLLMENT_CONFIRMED",
  ENROLLMENT_DRAFT_CREATED: "ENROLLMENT_DRAFT_CREATED",
  ENROLLMENT_FINANCIAL_CREATED: "ENROLLMENT_FINANCIAL_CREATED",
  ENROLLMENT_FINANCIAL_OBLIGATION_CREATED: "ENROLLMENT_FINANCIAL_OBLIGATION_CREATED",
  ENROLLMENT_SCHEDULE_CREATED: "ENROLLMENT_SCHEDULE_CREATED",
});

const ENROLLMENT_NOTIFICATION_EVENT_TYPES = Object.freeze(
  Object.values(EnrollmentNotificationEventType),
);

const EVENT_ALLOWED_STATUSES = Object.freeze({
  [EnrollmentNotificationEventType.ENROLLMENT_CLASS_LINKED]: ["ACTIVE"],
  [EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED]: ["ACTIVE"],
  [EnrollmentNotificationEventType.ENROLLMENT_DRAFT_CREATED]: ["DRAFT"],
  [EnrollmentNotificationEventType.ENROLLMENT_FINANCIAL_CREATED]: ["ACTIVE"],
  [EnrollmentNotificationEventType.ENROLLMENT_FINANCIAL_OBLIGATION_CREATED]: ["ACTIVE"],
  [EnrollmentNotificationEventType.ENROLLMENT_SCHEDULE_CREATED]: ["ACTIVE"],
});

/**
 * Contract-only preparation for a future Enrollment -> Notificacoes event.
 *
 * It validates a minimal, safe payload and returns a no-send plan. It does not
 * create in-app notifications, send e-mail, WhatsApp or push messages.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {string|null} [input.eventType]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|null} [input.requestedBy]
 * @param {string|null} [input.occurredAt]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentNotification(input = {}) {
  const enrollmentId = nullableText(input.enrollmentId, 64);
  const studentPersonId = nullableText(input.studentPersonId, 64);
  const studentProfileId = nullableText(input.studentProfileId, 64);
  const eventType = normalizeEventType(input.eventType);
  const enrollmentStatus = normalizeUpperText(input.enrollmentStatus);
  const occurredAt = nullableText(input.occurredAt, 40);
  const requestedBy = nullableText(input.requestedBy, 191);

  if (!enrollmentId || !studentPersonId || !studentProfileId || !eventType || !requestedBy) {
    throw controlledError(
      "prepareEnrollmentNotification requires enrollmentId, studentPersonId, studentProfileId, eventType and requestedBy.",
      ENROLLMENT_NOTIFICATION_INPUT_REQUIRED_CODE,
      {
        hasEnrollmentId: Boolean(enrollmentId),
        hasEventType: Boolean(eventType),
        hasRequestedBy: Boolean(requestedBy),
        hasStudentPersonId: Boolean(studentPersonId),
        hasStudentProfileId: Boolean(studentProfileId),
      },
    );
  }

  if (!ENROLLMENT_NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    throw controlledError(
      "prepareEnrollmentNotification received an unsupported eventType.",
      ENROLLMENT_NOTIFICATION_INVALID_EVENT_TYPE_CODE,
      {
        allowedEventTypes: [...ENROLLMENT_NOTIFICATION_EVENT_TYPES],
        eventType,
      },
    );
  }

  const allowedEnrollmentStatuses = EVENT_ALLOWED_STATUSES[eventType] || [];

  if (enrollmentStatus && !allowedEnrollmentStatuses.includes(enrollmentStatus)) {
    throw controlledError(
      "Enrollment status is not compatible with the notification event.",
      ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS_CODE,
      {
        allowedEnrollmentStatuses,
        enrollmentId,
        enrollmentStatus,
        eventType,
      },
    );
  }

  return {
    allowedEnrollmentStatuses,
    blocked: true,
    blockedBySchemaOrModuleGap: true,
    blockerCode: ENROLLMENT_NOTIFICATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
    canPersist: false,
    channels: {
      email: {
        enabled: false,
        sent: false,
      },
      inApp: {
        created: false,
        supportedToday: true,
      },
      push: {
        enabled: false,
        sent: false,
      },
      whatsapp: {
        enabled: false,
        sent: false,
      },
    },
    contractDocumented: true,
    contractVersion: ENROLLMENT_NOTIFICATION_CONTRACT_VERSION,
    duplicateNotificationCheckAvailable: false,
    duplicateNotificationCheckBlockedBySchemaOrModuleGap: true,
    emailSent: false,
    enrollmentId,
    enrollmentStatus: enrollmentStatus || null,
    eventType,
    futureRules: [
      "Notification events must use a stable enrollment idempotency key.",
      "Notification creation should be asynchronous or routed through a dispatcher.",
      "Payloads must contain only minimal identifiers and event metadata.",
      "Templates and recipient preferences must be resolved by Notificacoes, not Matriculas.",
      "E-mail, WhatsApp and push must remain disabled until dedicated adapters exist.",
      "A dedicated enrollment-notification link table should be created before real persistence.",
    ],
    metadata: normalizeMetadata(input.metadata),
    minimalPayload: removeNullish({
      enrollmentId,
      eventType,
      occurredAt,
      studentPersonId,
      studentProfileId,
    }),
    notificationCreated: false,
    notificationCreationBlockedBySchemaOrModuleGap: true,
    notificationModule: {
      currentReadRoute: "backend/src/routes/notificacoes.routes.js",
      currentRepository: "backend/src/repositories/notificacao.repository.js",
      currentService: "backend/src/services/notificacao.service.js",
      dedicatedDomainBoundary: "backend/src/domains/notificacoes",
      dedicatedEnrollmentNotificationTableExists: false,
      existingTables: ["j12_notificacoes", "student_notifications"],
      idempotencyToday: "same aluno_id, titulo, mensagem and current date only",
      socketEventName: "nova_notificacao",
    },
    notificationTable: {
      required: true,
      tableName: REQUIRED_NOTIFICATION_LINK_TABLE,
      suggestedColumns: [
        "id",
        "enrollment_id",
        "student_person_id",
        "student_profile_id",
        "event_type",
        "notification_id",
        "status",
        "idempotency_key",
        "requested_by",
        "metadata_json",
        "created_at",
        "updated_at",
      ],
      suggestedUniqueKey: ["idempotency_key"],
    },
    persisted: false,
    prepared: true,
    pushSent: false,
    requestedBy,
    requiresDedicatedNotificationLinkTable: true,
    requiresDispatcher: true,
    requiresMigration: true,
    safePayload: true,
    status: ENROLLMENT_NOTIFICATION_PREPARED_STATUS,
    studentPersonId,
    studentProfileId,
    whatsappSent: false,
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeEventType(value) {
  return normalizeUpperText(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeMetadata(value = {}) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};

  for (const [key, item] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey) {
      continue;
    }

    if (item === null || ["boolean", "number", "string"].includes(typeof item)) {
      normalized[normalizedKey] = typeof item === "string" ? nullableText(item, 191) : item;
    }
  }

  return {
    noEmailSent: true,
    noNotificationCreated: true,
    noPushSent: true,
    noWhatsappSent: true,
    preparedOnly: true,
    ...normalized,
  };
}

/**
 * @param {Record<string, unknown>} value
 * @returns {Record<string, unknown>}
 */
function removeNullish(value) {
  const normalized = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined && item !== "") {
      normalized[key] = item;
    }
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeUpperText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
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
  ENROLLMENT_NOTIFICATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
  ENROLLMENT_NOTIFICATION_CONTRACT_VERSION,
  ENROLLMENT_NOTIFICATION_EVENT_TYPES,
  ENROLLMENT_NOTIFICATION_INPUT_REQUIRED_CODE,
  ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_NOTIFICATION_INVALID_EVENT_TYPE_CODE,
  ENROLLMENT_NOTIFICATION_PREPARED_STATUS,
  EnrollmentNotificationEventType,
  REQUIRED_NOTIFICATION_LINK_TABLE,
  prepareEnrollmentNotification,
};
