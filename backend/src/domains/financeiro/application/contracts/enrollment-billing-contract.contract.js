const FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE =
  "FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED";
const FINANCIAL_BILLING_CONTRACT_VERSION = "sprint-12.3";
const REQUIRED_ENROLLMENT_STATUS_FOR_BILLING = "ACTIVE";

const FinancialBillingContractStatus = Object.freeze({
  BLOCKED: "BLOCKED",
  READY: "READY",
});

const FinancialBillingContractBlocker = Object.freeze({
  BILLING_AMOUNT_NOT_RESOLVED: "BILLING_AMOUNT_NOT_RESOLVED",
  BILLING_CURRENCY_NOT_RESOLVED: "BILLING_CURRENCY_NOT_RESOLVED",
  BILLING_CYCLE_NOT_RESOLVED: "BILLING_CYCLE_NOT_RESOLVED",
  BILLING_DUE_DAY_NOT_RESOLVED: "BILLING_DUE_DAY_NOT_RESOLVED",
  BILLING_FIRST_DUE_DATE_NOT_RESOLVED: "BILLING_FIRST_DUE_DATE_NOT_RESOLVED",
  BILLING_PLAN_NOT_RESOLVED: "BILLING_PLAN_NOT_RESOLVED",
  ENROLLMENT_NOT_ACTIVE: "ENROLLMENT_NOT_ACTIVE",
  ENROLLMENT_STATUS_NOT_RESOLVED: "ENROLLMENT_STATUS_NOT_RESOLVED",
  STUDENT_SCOPE_MISSING: "STUDENT_SCOPE_MISSING",
});

/**
 * Normalizes the read-only billing contract for a future Enrollment charge.
 *
 * It does not create charges, installments, payments or schema changes. Missing
 * plan, amount or due date data is represented as explicit blockers.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {string|number|null} [input.classId]
 * @param {string|null} [input.requestedBy]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|number|null} [input.planId]
 * @param {number|string|null} [input.amount]
 * @param {number|string|null} [input.dueDay]
 * @param {string|null} [input.firstDueDate]
 * @param {string|null} [input.billingCycle]
 * @param {string|null} [input.currency]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentBillingContract(input = {}) {
  const enrollmentId = nullableText(input.enrollmentId, 64);
  const requestedBy = nullableText(input.requestedBy, 191);

  if (!enrollmentId || !requestedBy) {
    throw controlledError(
      "prepareEnrollmentBillingContract requires enrollmentId and requestedBy.",
      FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE,
      {
        hasEnrollmentId: Boolean(enrollmentId),
        hasRequestedBy: Boolean(requestedBy),
      },
    );
  }

  const firstDueDate = normalizeDate(input.firstDueDate ?? input.dueDate ?? input.vencimento);
  const dueDay = normalizeDueDay(input.dueDay ?? extractDayFromDate(firstDueDate));
  const enrollmentStatus = normalizeUpperText(input.enrollmentStatus);
  const planId = nullableText(
    input.planId ?? input.planoId ?? readProperty(input.plan, "id") ?? readProperty(input.plan, "planId"),
    64,
  );
  const amount = normalizePositiveAmount(
    input.amount ??
      input.valor ??
      input.planAmount ??
      readProperty(input.plan, "amount") ??
      readProperty(input.plan, "valor") ??
      readProperty(input.plan, "precoMensal") ??
      readProperty(input.plan, "preco_mensal"),
  );
  const billingCycle = normalizeBillingCycle(
    input.billingCycle ?? input.cycle ?? input.periodicity ?? input.periodicidade,
  );
  const currency = normalizeCurrency(input.currency ?? input.moeda);
  const studentPersonId = nullableText(input.studentPersonId ?? input.student_person_id, 64);
  const studentProfileId = nullableText(input.studentProfileId ?? input.student_profile_id, 64);
  const classId = nullableText(input.classId ?? input.class_id ?? input.turmaId ?? input.turma_id, 64);

  const blockers = [];

  if (!studentPersonId || !studentProfileId) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.STUDENT_SCOPE_MISSING,
      "Student person/profile identifiers were not resolved.",
    ));
  }

  if (!enrollmentStatus) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.ENROLLMENT_STATUS_NOT_RESOLVED,
      "Enrollment status was not resolved.",
    ));
  } else if (enrollmentStatus !== REQUIRED_ENROLLMENT_STATUS_FOR_BILLING) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.ENROLLMENT_NOT_ACTIVE,
      "Only ACTIVE Enrollment can create billing.",
    ));
  }

  if (!planId) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_PLAN_NOT_RESOLVED,
      "No reliable billing plan source was resolved for this Enrollment.",
    ));
  }

  if (amount === null) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_AMOUNT_NOT_RESOLVED,
      "No reliable positive amount was resolved for this Enrollment.",
    ));
  }

  if (dueDay === null) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_DUE_DAY_NOT_RESOLVED,
      "No reliable due day was resolved for this Enrollment.",
    ));
  }

  if (!firstDueDate) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_FIRST_DUE_DATE_NOT_RESOLVED,
      "No reliable first due date was resolved for this Enrollment.",
    ));
  }

  if (!billingCycle) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_CYCLE_NOT_RESOLVED,
      "No reliable billing cycle was resolved for this Enrollment.",
    ));
  }

  if (!currency) {
    blockers.push(createBlocker(
      FinancialBillingContractBlocker.BILLING_CURRENCY_NOT_RESOLVED,
      "No reliable billing currency was resolved for this Enrollment.",
    ));
  }

  const canCreateBilling = blockers.length === 0;

  return {
    amount,
    billingContractPrepared: true,
    billingContractReadOnly: true,
    billingCycle,
    blockers,
    canCreateBilling,
    chargeCreated: false,
    classId,
    contractVersion: FINANCIAL_BILLING_CONTRACT_VERSION,
    currency,
    dueDay,
    enrollmentId,
    enrollmentStatus,
    firstDueDate,
    financialEntryCreated: false,
    installmentCreated: false,
    metadata: normalizeMetadata(input.metadata),
    noChargeCreated: true,
    noFinancialEntryCreated: true,
    noInstallmentCreated: true,
    noPaymentCreated: true,
    paymentCreated: false,
    persisted: false,
    planId,
    prepared: true,
    readOnly: true,
    requestedBy,
    requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_BILLING,
    schemaChanged: false,
    status: canCreateBilling
      ? FinancialBillingContractStatus.READY
      : FinancialBillingContractStatus.BLOCKED,
    studentPersonId,
    studentProfileId,
  };
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function createBlocker(code, message) {
  return { code, message };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeBillingCycle(value) {
  const normalized = normalizeUpperText(value);

  if (!normalized) {
    return null;
  }

  const aliases = {
    ANNUAL: "ANNUAL",
    ANUAL: "ANNUAL",
    BIMESTRAL: "BIMONTHLY",
    BIMONTHLY: "BIMONTHLY",
    MENSAL: "MONTHLY",
    MENSALIDADE: "MONTHLY",
    MONTHLY: "MONTHLY",
    QUARTERLY: "QUARTERLY",
    SEMESTRAL: "SEMIANNUAL",
    SEMIANNUAL: "SEMIANNUAL",
    TRIMESTRAL: "QUARTERLY",
  };

  return aliases[normalized] || null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeCurrency(value) {
  const normalized = normalizeUpperText(value);
  return /^[A-Z]{3}$/.test(normalized || "") ? normalized : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeDate(value) {
  const normalized = nullableText(value, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized || "")) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeDueDay(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    return null;
  }

  return parsed;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizePositiveAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

/**
 * @param {string|null} value
 * @returns {number|null}
 */
function extractDayFromDate(value) {
  const normalized = normalizeDate(value);
  return normalized ? Number(normalized.slice(8, 10)) : null;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeMetadata(value = {}) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};
  const forbidden = [/senha/i, /password/i, /token/i, /cpf/i, /rg/i, /document/i, /stack/i];

  for (const [key, item] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey || forbidden.some((pattern) => pattern.test(normalizedKey))) {
      continue;
    }

    if (item === null || ["boolean", "number", "string"].includes(typeof item)) {
      normalized[normalizedKey] = typeof item === "string" ? nullableText(item, 191) : item;
    }
  }

  return {
    noChargeCreated: true,
    noInstallmentCreated: true,
    noPaymentCreated: true,
    preparedOnly: true,
    ...normalized,
  };
}

/**
 * @param {unknown} value
 * @param {string} property
 * @returns {unknown|null}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
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
  FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE,
  FINANCIAL_BILLING_CONTRACT_VERSION,
  FinancialBillingContractBlocker,
  FinancialBillingContractStatus,
  REQUIRED_ENROLLMENT_STATUS_FOR_BILLING,
  prepareEnrollmentBillingContract,
};
