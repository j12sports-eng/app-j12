const ENROLLMENT_FINANCIAL_LINK_INPUT_REQUIRED_CODE =
  "ENROLLMENT_FINANCIAL_LINK_INPUT_REQUIRED";
const ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS_CODE =
  "ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_FINANCIAL_LINK_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_FINANCIAL_LINK_CONTRACT_VERSION = "sprint-9.51";
const REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK = "ACTIVE";
const FUTURE_FINANCIAL_TRIGGER_EVENT = "EnrollmentConfirmed";
const FUTURE_FINANCIAL_CHARGE_TYPE = "mensalidade";

/**
 * Contract-only preparation for a future Enrollment -> Financeiro link.
 *
 * It validates the internal payload shape and returns a safe integration plan.
 * It does not create charges, installments, payments or financial entries.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {string|null} [input.requestedBy]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|null} [input.planId]
 * @param {string|null} [input.planName]
 * @param {string|null} [input.competence]
 * @param {string|null} [input.dueDate]
 * @param {number|null} [input.amount]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentFinancialLink(input = {}) {
  const enrollmentId = nullableText(input.enrollmentId, 64);
  const studentPersonId = nullableText(input.studentPersonId, 64);
  const studentProfileId = nullableText(input.studentProfileId, 64);
  const requestedBy = nullableText(input.requestedBy, 191);
  const enrollmentStatus =
    normalizeUpperText(input.enrollmentStatus) || REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK;

  if (!enrollmentId || !studentPersonId || !studentProfileId || !requestedBy) {
    throw controlledError(
      "prepareEnrollmentFinancialLink requires enrollmentId, studentPersonId, studentProfileId and requestedBy.",
      ENROLLMENT_FINANCIAL_LINK_INPUT_REQUIRED_CODE,
      {
        hasEnrollmentId: Boolean(enrollmentId),
        hasRequestedBy: Boolean(requestedBy),
        hasStudentPersonId: Boolean(studentPersonId),
        hasStudentProfileId: Boolean(studentProfileId),
      },
    );
  }

  if (enrollmentStatus !== REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK) {
    throw controlledError(
      "Only ACTIVE Enrollment can prepare a financial obligation link.",
      ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS_CODE,
      {
        enrollmentId,
        enrollmentStatus,
        requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK,
      },
    );
  }

  return {
    amount: normalizeOptionalAmount(input.amount),
    blockedBySchemaOrModuleGap: true,
    chargeCreated: false,
    chargeType: FUTURE_FINANCIAL_CHARGE_TYPE,
    competence: nullableText(input.competence, 7),
    contractVersion: ENROLLMENT_FINANCIAL_LINK_CONTRACT_VERSION,
    dedicatedEnrollmentFinancialLinkTableExists: false,
    dueDate: nullableText(input.dueDate, 10),
    duplicateFinancialObligationCheckAvailable: false,
    duplicateFinancialObligationCheckBlockedBySchemaOrModuleGap: true,
    enrollmentId,
    enrollmentStatus,
    externalIntegrationsTriggered: false,
    financialCreationBlockedBySchemaOrModuleGap: true,
    financialEntryCreated: false,
    financialModule: {
      chargeMirrorTable: "j12_financeiro_cobrancas",
      currentGenerationService: "backend/src/services/financeiro.service.js",
      currentRoutes: ["backend/src/routes/financeiro.routes.js"],
      dedicatedEnrollmentFinancialLinkTableExists: false,
      domainBoundary: "backend/src/domains/financeiro",
      enrollmentForeignKeyExists: false,
      legacyChargeTable: "financeiro",
      paymentTables: ["j12_pagamentos", "financial_payments"],
      planTable: "j12_planos",
      primaryChargeTable: "j12_financeiro_cobrancas",
      primaryInstallmentTable: "j12_mensalidades",
    },
    futureRules: [
      "Enrollment must be ACTIVE before any financial charge can be generated.",
      "The future flow should be triggered from EnrollmentConfirmed or an explicit internal handler for that event.",
      "The future flow must resolve the active student plan before calculating amount and due date.",
      "Duplicate charges must be prevented by competence, student and enrollment context.",
      "A dedicated enrollment-financial link table should be created before real persistence.",
    ],
    futureTriggerEvent: FUTURE_FINANCIAL_TRIGGER_EVENT,
    idempotent: true,
    installmentCreated: false,
    metadata: normalizeMetadata(input.metadata),
    noChargeCreated: true,
    noFinancialEntryCreated: true,
    noInstallmentCreated: true,
    obligationCreated: false,
    persisted: false,
    planId: nullableText(input.planId, 64),
    planName: nullableText(input.planName, 191),
    prepared: true,
    requestedBy,
    requiresDedicatedEnrollmentFinancialLinkTable: true,
    requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK,
    requiredFutureFields: [
      "enrollmentId",
      "studentPersonId",
      "studentProfileId",
      "planId",
      "amount",
      "competence",
      "dueDate",
      "requestedBy",
    ],
    requiresMigration: true,
    status: ENROLLMENT_FINANCIAL_LINK_PREPARED_STATUS,
    studentPersonId,
    studentProfileId,
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
    noChargeCreated: true,
    noFinancialEntryCreated: true,
    noInstallmentCreated: true,
    preparedOnly: true,
    ...normalized,
  };
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeOptionalAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
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
  ENROLLMENT_FINANCIAL_LINK_CONTRACT_VERSION,
  ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_FINANCIAL_LINK_INPUT_REQUIRED_CODE,
  ENROLLMENT_FINANCIAL_LINK_PREPARED_STATUS,
  FUTURE_FINANCIAL_CHARGE_TYPE,
  FUTURE_FINANCIAL_TRIGGER_EVENT,
  REQUIRED_ENROLLMENT_STATUS_FOR_FINANCIAL_LINK,
  prepareEnrollmentFinancialLink,
};
