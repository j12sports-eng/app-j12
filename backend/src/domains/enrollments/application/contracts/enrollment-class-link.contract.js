const ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE = "ENROLLMENT_CLASS_LINK_INPUT_REQUIRED";
const ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE = "ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID";
const ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE = "ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE = "ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS";
const ENROLLMENT_CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE = "CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP";
const ENROLLMENT_CLASS_LINK_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_CLASS_LINK_CONTRACT_VERSION = "sprint-9.50";
const REQUIRED_CLASS_LINK_TABLE = "enrollment_class_links";
const REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK = "ACTIVE";
const ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK = Object.freeze(["ativa"]);

/**
 * Contract-only preparation for a future Enrollment -> Turma link.
 *
 * It validates the internal payload shape and returns a safe integration plan.
 * It does not persist data, update Turmas, update Financeiro or call external
 * modules.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.classId]
 * @param {string|null} [input.turmaId]
 * @param {string|null} [input.requestedBy]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|null} [input.classStatus]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentClassLink(input = {}) {
  const enrollmentId = nullableText(input.enrollmentId, 64);
  const classId = nullableText(input.classId ?? input.turmaId, 64);
  const requestedBy = nullableText(input.requestedBy, 191);
  const enrollmentStatus = normalizeUpperText(input.enrollmentStatus) || REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK;
  const classStatus = normalizeLowerText(input.classStatus) || ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK[0];

  if (!enrollmentId || !classId || !requestedBy) {
    throw controlledError(
      "prepareEnrollmentClassLink requires enrollmentId, classId and requestedBy.",
      ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE,
      {
        hasClassId: Boolean(classId),
        hasEnrollmentId: Boolean(enrollmentId),
        hasRequestedBy: Boolean(requestedBy),
      },
    );
  }

  if (!/^\d+$/.test(classId)) {
    throw controlledError(
      "prepareEnrollmentClassLink requires a numeric classId compatible with j12_turmas.id.",
      ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
      {
        classId,
      },
    );
  }

  if (enrollmentStatus !== REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK) {
    throw controlledError(
      "Enrollment must be ACTIVE before a class link can be prepared.",
      ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
      {
        enrollmentId,
        enrollmentStatus,
        requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK,
      },
    );
  }

  if (!ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK.includes(classStatus)) {
    throw controlledError(
      "Class must be active before a class link can be prepared.",
      ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
      {
        allowedClassStatuses: [...ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK],
        classId,
        classStatus,
      },
    );
  }

  return {
    allowedClassStatuses: [...ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK],
    blocked: true,
    blockedBySchemaOrModuleGap: true,
    blockerCode: ENROLLMENT_CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
    canPersist: false,
    classId,
    classModuleMapped: true,
    classModule: {
      capacityField: "j12_turmas.capacidade",
      currentStudentLinkFields: [
        "j12_alunos.turma_id",
        "j12_alunos.turma_principal",
        "j12_turmas.aluno_ids_json",
      ],
      dedicatedEnrollmentClassLinkTableExists: false,
      existingBackendSurface: "backend/src/routes/turmas.routes.js",
      identifier: "j12_turmas.id",
      knownStatuses: [...ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK, "inativa"],
      statusField: "j12_turmas.status",
      tableName: "j12_turmas",
    },
    classStatus,
    contractDocumented: true,
    contractVersion: ENROLLMENT_CLASS_LINK_CONTRACT_VERSION,
    enrollmentId,
    enrollmentStatus,
    financialSideEffects: false,
    futureRules: [
      "Enrollment must be ACTIVE before a class link can be persisted.",
      "Class must exist in j12_turmas and be active.",
      "Capacity must be checked before linking.",
      "A dedicated enrollment-class link table should be created before real persistence.",
      "Financial generation must remain outside this contract.",
    ],
    linkCreated: false,
    linkTable: {
      required: true,
      tableName: REQUIRED_CLASS_LINK_TABLE,
      suggestedColumns: [
        "id",
        "enrollment_id",
        "class_id",
        "linked_at",
        "linked_by",
        "status",
        "metadata_json",
        "created_at",
        "updated_at",
      ],
      suggestedUniqueKey: ["enrollment_id", "class_id", "status_active_or_current"],
    },
    metadata: normalizeMetadata(input.metadata),
    persisted: false,
    prepared: true,
    requestedBy,
    requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK,
    requiresDedicatedLinkTable: true,
    requiresMigration: true,
    status: ENROLLMENT_CLASS_LINK_PREPARED_STATUS,
  };
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
    noClassLinkCreated: true,
    noFinancialSideEffects: true,
    preparedOnly: true,
    ...normalized,
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeLowerText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toLowerCase() : null;
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
  ALLOWED_CLASS_STATUSES_FOR_CLASS_LINK,
  ENROLLMENT_CLASS_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
  ENROLLMENT_CLASS_LINK_CONTRACT_VERSION,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_PREPARED_STATUS,
  REQUIRED_CLASS_LINK_TABLE,
  REQUIRED_ENROLLMENT_STATUS_FOR_CLASS_LINK,
  prepareEnrollmentClassLink,
};
