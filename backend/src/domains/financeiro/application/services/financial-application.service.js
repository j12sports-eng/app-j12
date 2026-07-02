const {
  FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE,
  prepareEnrollmentBillingContract: buildEnrollmentBillingContract,
} = require("../contracts/enrollment-billing-contract.contract.js");

const FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND_CODE =
  "FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND";
const FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH_CODE =
  "FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH";
const FINANCIAL_BILLING_SOURCE_READER_INVALID_CODE =
  "FINANCIAL_BILLING_SOURCE_READER_INVALID";
const INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE =
  "INITIAL_ENROLLMENT_OBLIGATION";
const FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP_CODE =
  "FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP";
const FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE =
  "FINANCIAL_OBLIGATION_INPUT_REQUIRED";
const FINANCIAL_OBLIGATION_NOT_FOUND_CODE =
  "FINANCIAL_OBLIGATION_NOT_FOUND";
const FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE =
  "FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION";
const FINANCIAL_STUDENT_SCOPE_SEARCH_INPUT_REQUIRED_CODE =
  "FINANCIAL_STUDENT_SCOPE_SEARCH_INPUT_REQUIRED";
const FinancialObligationStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  PENDING: "PENDING",
  PREPARED: "PREPARED",
});
const OPEN_FINANCIAL_OBLIGATION_STATUSES = Object.freeze([
  FinancialObligationStatus.PENDING,
  FinancialObligationStatus.PREPARED,
]);
const PAYABLE_FINANCIAL_OBLIGATION_STATUSES = Object.freeze([
  ...OPEN_FINANCIAL_OBLIGATION_STATUSES,
  FinancialObligationStatus.OVERDUE,
]);

/**
 * Application service for the Financeiro domain boundary.
 *
 * It validates the Enrollment and normalizes billing/obligation contracts. It
 * only persists internal Enrollment obligation records when a safe repository
 * with enrollment_id + obligation_type idempotency is provided.
 */
class FinancialApplicationService {
  /**
   * @param {Object} [options]
 * @param {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }} [options.enrollmentReader]
 * @param {Function|Record<string, Function>|null} [options.billingSourceReader]
 * @param {Record<string, Function>|null} [options.financialObligationRepository]
 * @param {{ searchStudentScopes?: (input: Record<string, unknown>) => Promise<unknown[]> }|null} [options.studentScopeReader]
   */
  constructor({
    enrollmentReader = null,
    billingSourceReader = null,
    financialObligationRepository = null,
    studentScopeReader = null,
  } = {}) {
    this.enrollmentReader = enrollmentReader;
    this.billingSourceReader = billingSourceReader;
    this.financialObligationRepository = financialObligationRepository;
    this.studentScopeReader = studentScopeReader;
  }

  /**
   * Prepares the plan/amount/due-date contract for a future initial billing
   * obligation from an Enrollment.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|number|null} [input.classId]
   * @param {string|null} [input.requestedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareEnrollmentBillingContract(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    const base = {
      enrollmentId,
      requestedBy,
    };

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

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for billing contract preparation.",
        FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeUpperText(readProperty(enrollment, "status"));
    const studentPersonId = readEnrollmentStudentId(enrollment, input, [
      "studentPersonId",
      "student_person_id",
    ]);
    const studentProfileId = readEnrollmentStudentId(enrollment, input, [
      "studentProfileId",
      "student_profile_id",
    ]);
    const classId =
      nullableText(input.classId ?? input.class_id ?? input.turmaId ?? input.turma_id, 64) ||
      nullableText(
        readProperty(enrollment, "classId") ??
          readProperty(enrollment, "class_id") ??
          readProperty(enrollment, "turmaId") ??
          readProperty(enrollment, "turma_id"),
        64,
      );

    assertInputStudentMatchesEnrollment(input, {
      enrollmentId,
      studentPersonId,
      studentProfileId,
    });

    const billingSource = await this.resolveBillingSource({
      classId,
      enrollment,
      enrollmentId,
      enrollmentStatus,
      requestedBy,
      studentPersonId,
      studentProfileId,
    });

    const contract = buildEnrollmentBillingContract({
      ...readObject(billingSource),
      ...base,
      classId,
      enrollmentStatus,
      metadata: {
        billingSourceReaderConfigured: Boolean(this.billingSourceReader),
        operation: "prepareEnrollmentBillingContract",
        ...readObject(readObject(billingSource).metadata),
        ...readObject(input.metadata),
      },
      studentPersonId,
      studentProfileId,
    });

    return {
      ...contract,
      billingSourceReaderConfigured: Boolean(this.billingSourceReader),
      blockersDocumented: contract.blockers.length > 0,
      enrollmentFound: true,
      sources: {
        billing: this.billingSourceReader ? "billingSourceReader" : null,
        enrollment: "enrollmentReader",
        legacyFinanceiroWriteUsed: false,
        publicApiChanged: false,
      },
    };
  }

  /**
   * Creates or reuses the initial Enrollment financial obligation record when
   * the billing contract is complete and the idempotent repository is available.
   * It does not create charges, installments, payments, gateway calls,
   * notifications or schedule records.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.requestedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createInitialEnrollmentFinancialObligation(input = {}) {
    const billingContract = await this.prepareEnrollmentBillingContract({
      ...input,
      metadata: {
        ...readObject(input.metadata),
        operation: "createInitialEnrollmentFinancialObligation",
      },
    });
    const idempotencyKey = buildInitialObligationIdempotencyKey(billingContract.enrollmentId);
    const billingContractBlockers = Array.isArray(billingContract.blockers)
      ? billingContract.blockers
      : [];
    const blockedByBillingContract = billingContractBlockers.length > 0;

    if (!blockedByBillingContract && this.hasFinancialObligationRepository()) {
      const repositoryResult = await this
        .getFinancialObligationRepository()
        .createEnrollmentFinancialObligationRecord({
          amount: billingContract.amount,
          createdBy: billingContract.requestedBy,
          currency: billingContract.currency,
          dueDate: billingContract.firstDueDate,
          enrollmentId: billingContract.enrollmentId,
          metadata: buildInitialObligationMetadata(billingContract),
          obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
          planId: billingContract.planId,
          source: "ENROLLMENT",
          status: "PREPARED",
        });
      const obligation = readObject(repositoryResult.obligation);
      const obligationId = nullableText(obligation.id, 64);
      const created = repositoryResult.created === true;
      const reused = repositoryResult.reused === true;

      return {
        amount: readProperty(obligation, "amount") ?? billingContract.amount,
        billingContract,
        billingContractBlockers,
        billingContractCanCreateBilling: billingContract.canCreateBilling === true,
        blocked: false,
        blockedByBillingContract: false,
        blockedBySchemaOrRuleGap: false,
        blockers: [],
        canCreateInitialObligation: true,
        chargeCreated: false,
        classId: billingContract.classId,
        created,
        currency: readProperty(obligation, "currency") ?? billingContract.currency,
        dueDay: billingContract.dueDay,
        enrollmentId: billingContract.enrollmentId,
        enrollmentStatus: billingContract.enrollmentStatus,
        existing: reused,
        financialEntryCreated: false,
        firstDueDate: readProperty(obligation, "dueDate") ?? billingContract.firstDueDate,
        idempotency: {
          duplicateCheckAvailable: true,
          fields: ["enrollment_id", "obligation_type"],
          key: idempotencyKey,
          safeToRetry: true,
          supportedBySchema: true,
        },
        initialFinancialObligationPersistenceEnabled: true,
        initialFinancialObligationPrepared: true,
        installmentCreated: false,
        noChargeCreated: true,
        noClassSideEffects: true,
        noFinancialEntryCreated: true,
        noGatewayIntegration: true,
        noInstallmentCreated: true,
        noNotificationSideEffects: true,
        noPaymentCreated: true,
        noScheduleSideEffects: true,
        noSchemaChange: true,
        obligation,
        obligationCreated: created,
        obligationId,
        obligationType:
          nullableText(readProperty(obligation, "obligationType"), 64) ||
          INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
        paymentCreated: false,
        persisted: Boolean(obligationId),
        planId: readProperty(obligation, "planId") ?? billingContract.planId,
        prepared: true,
        reused,
        status: nullableText(readProperty(obligation, "status"), 32) || "PREPARED",
      };
    }

    const blockers = blockedByBillingContract
      ? billingContractBlockers
      : [
          {
            code: FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP_CODE,
            message:
              "Initial financial obligation persistence requires the approved idempotent repository for enrollment_id + obligation_type.",
          },
        ];

    return {
      amount: billingContract.amount,
      billingContract,
      billingContractBlockers,
      billingContractCanCreateBilling: billingContract.canCreateBilling === true,
      blocked: true,
      blockedByBillingContract,
      blockedBySchemaOrRuleGap: !blockedByBillingContract,
      blockers,
      canCreateInitialObligation: false,
      chargeCreated: false,
      classId: billingContract.classId,
      created: false,
      currency: billingContract.currency,
      dueDay: billingContract.dueDay,
      enrollmentId: billingContract.enrollmentId,
      enrollmentStatus: billingContract.enrollmentStatus,
      existing: false,
      financialEntryCreated: false,
      firstDueDate: billingContract.firstDueDate,
      idempotency: {
        duplicateCheckAvailable: false,
        fields: ["enrollment_id", "obligation_type"],
        key: idempotencyKey,
        safeToRetry: true,
        supportedBySchema: false,
      },
      initialFinancialObligationPrepared: true,
      initialFinancialObligationPersistencePrepared: !blockedByBillingContract,
      installmentCreated: false,
      noChargeCreated: true,
      noClassSideEffects: true,
      noFinancialEntryCreated: true,
      noInstallmentCreated: true,
      noNotificationSideEffects: true,
      noPaymentCreated: true,
      noScheduleSideEffects: true,
      noSchemaChange: true,
      obligationCreated: false,
      obligationId: null,
      obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
      paymentCreated: false,
      persisted: false,
      planId: billingContract.planId,
      prepared: true,
      reused: false,
      status: "BLOCKED",
    };
  }

  /**
   * @param {{ enrollmentId?: string|null, obligationType?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findEnrollmentFinancialObligation(input = {}) {
    return this.getFinancialObligationRepository().findEnrollmentFinancialObligation(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async createEnrollmentFinancialObligationRecord(input = {}) {
    return this.getFinancialObligationRepository().createEnrollmentFinancialObligationRecord(input);
  }

  /**
   * @param {{ enrollmentId?: string|null, limit?: number|null }} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async listEnrollmentFinancialObligations(input = {}) {
    const enrollmentId = requiredInputText(input.enrollmentId, "enrollmentId", 64);
    const limit = normalizeResultLimit(input.limit, 100);
    const obligations = await this
      .getFinancialObligationAdminRepository()
      .listEnrollmentFinancialObligations({ enrollmentId, limit });

    return {
      count: obligations.length,
      enrollmentId,
      financialObligationsEndpointReady: true,
      noGatewayIntegration: true,
      noNotificationSideEffects: true,
      obligations,
    };
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null, limit?: number|null }} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async getStudentFinancialSummary(input = {}) {
    const studentPersonId = requiredInputText(input.studentPersonId, "studentPersonId", 64);
    const studentProfileId = requiredInputText(input.studentProfileId, "studentProfileId", 64);
    const limit = normalizeResultLimit(input.limit, 250);
    const obligations = await this
      .getFinancialObligationAdminRepository()
      .listEnrollmentFinancialObligationsByStudentScope({
        limit,
        studentPersonId,
        studentProfileId,
      });

    return {
      count: obligations.length,
      financialSummaryEndpointReady: true,
      noGatewayIntegration: true,
      noNotificationSideEffects: true,
      obligations,
      studentPersonId,
      studentProfileId,
      summary: buildFinancialObligationsSummary(obligations),
    };
  }

  /**
   * Searches Aluno Pessoa/Profile scopes for the financial admin panel through
   * an injected reader. Financeiro does not duplicate People/Enrollment SQL.
   *
   * @param {{ query?: string|null, limit?: number|null }} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async searchFinancialStudentScopes(input = {}) {
    const query = nullableText(input.query ?? input.q ?? input.search, 100);

    if (!query || query.length < 2) {
      throw controlledError(
        "Financial student scope search requires at least 2 characters.",
        FINANCIAL_STUDENT_SCOPE_SEARCH_INPUT_REQUIRED_CODE,
        { field: "query" },
      );
    }

    const limit = normalizeResultLimit(input.limit, 25);
    const scopes = await this.getFinancialStudentScopeReader().searchStudentScopes({
      limit,
      query,
    });
    const scopeList = Array.isArray(scopes) ? scopes : [];

    return {
      count: scopeList.length,
      financialStudentScopeSearchReady: true,
      noGatewayIntegration: true,
      noNotificationSideEffects: true,
      query,
      scopes: scopeList,
    };
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.obligationId]
   * @param {string|Date|null} [input.paidAt]
   * @param {string|null} [input.paidBy]
   * @param {string|null} [input.paymentReference]
   * @returns {Promise<Record<string, unknown>>}
   */
  async markEnrollmentFinancialObligationAsPaid(input = {}) {
    const obligationId = requiredInputText(input.obligationId, "obligationId", 64);
    const paidAt = requiredDateTimeText(input.paidAt, "paidAt");
    const paidBy = requiredInputText(input.paidBy, "paidBy", 191);
    const paymentReference = nullableText(input.paymentReference, 191);

    return this.transitionEnrollmentFinancialObligationStatus({
      action: "MARK_PAID",
      actor: paidBy,
      allowedCurrentStatuses: PAYABLE_FINANCIAL_OBLIGATION_STATUSES,
      audit: {
        paidAt,
        paidBy,
        paymentReference,
      },
      cancel: false,
      occurredAt: paidAt,
      obligationId,
      targetStatus: FinancialObligationStatus.PAID,
    });
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.obligationId]
   * @param {string|Date|null} [input.cancelledAt]
   * @param {string|null} [input.cancelledBy]
   * @param {string|null} [input.reason]
   * @returns {Promise<Record<string, unknown>>}
   */
  async cancelEnrollmentFinancialObligation(input = {}) {
    const obligationId = requiredInputText(input.obligationId, "obligationId", 64);
    const cancelledAt = requiredDateTimeText(input.cancelledAt, "cancelledAt");
    const cancelledBy = requiredInputText(input.cancelledBy, "cancelledBy", 191);
    const reason = requiredInputText(input.reason, "reason", 191);

    return this.transitionEnrollmentFinancialObligationStatus({
      action: "CANCEL",
      actor: cancelledBy,
      allowedCurrentStatuses: PAYABLE_FINANCIAL_OBLIGATION_STATUSES,
      audit: {
        cancelledAt,
        cancelledBy,
        reason,
      },
      cancel: true,
      occurredAt: cancelledAt,
      obligationId,
      targetStatus: FinancialObligationStatus.CANCELLED,
    });
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.obligationId]
   * @param {string|Date|null} [input.checkedAt]
   * @returns {Promise<Record<string, unknown>>}
   */
  async markEnrollmentFinancialObligationAsOverdue(input = {}) {
    const obligationId = requiredInputText(input.obligationId, "obligationId", 64);
    const checkedAt = requiredDateTimeText(input.checkedAt, "checkedAt");

    return this.transitionEnrollmentFinancialObligationStatus({
      action: "MARK_OVERDUE",
      actor: "system",
      allowedCurrentStatuses: OPEN_FINANCIAL_OBLIGATION_STATUSES,
      audit: {
        checkedAt,
      },
      cancel: false,
      occurredAt: checkedAt,
      obligationId,
      targetStatus: FinancialObligationStatus.OVERDUE,
    });
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async transitionEnrollmentFinancialObligationStatus(input = {}) {
    const repository = this.getFinancialObligationStatusRepository();
    const obligation = await repository.findEnrollmentFinancialObligationById({
      obligationId: input.obligationId,
    });

    if (!obligation) {
      throw controlledError(
        "Enrollment financial obligation was not found.",
        FINANCIAL_OBLIGATION_NOT_FOUND_CODE,
        { obligationId: input.obligationId },
      );
    }

    const previousStatus = normalizeUpperText(readProperty(obligation, "status"));
    const allowedCurrentStatuses = Array.isArray(input.allowedCurrentStatuses)
      ? input.allowedCurrentStatuses
      : [];

    assertFinancialObligationStatusTransition({
      allowedCurrentStatuses,
      obligationId: input.obligationId,
      previousStatus,
      targetStatus: input.targetStatus,
    });

    const metadata = buildFinancialObligationStatusMetadata(obligation, {
      action: input.action,
      actor: input.actor,
      audit: input.audit,
      occurredAt: input.occurredAt,
      previousStatus,
      targetStatus: input.targetStatus,
    });
    const updateResult = await repository.updateEnrollmentFinancialObligationStatus({
      cancelledAt: input.cancel ? input.occurredAt : null,
      cancelledBy: input.cancel ? input.actor : null,
      currentStatuses: allowedCurrentStatuses,
      metadata,
      obligationId: input.obligationId,
      status: input.targetStatus,
    });

    if (!updateResult.updated) {
      const latestStatus = normalizeUpperText(readProperty(updateResult.obligation, "status"));
      throw controlledError(
        "Enrollment financial obligation status transition was blocked.",
        FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE,
        {
          allowedCurrentStatuses,
          currentStatus: latestStatus,
          obligationId: input.obligationId,
          targetStatus: input.targetStatus,
        },
      );
    }

    const updatedObligation = readObject(updateResult.obligation);

    return {
      auditPersisted: true,
      changed: true,
      currentStatus: normalizeUpperText(readProperty(updatedObligation, "status")),
      financialObligationStatusFlowEnabled: true,
      gatewayIntegrated: false,
      noClassSideEffects: true,
      noGatewayIntegration: true,
      noNotificationSideEffects: true,
      noPaymentCreated: true,
      noScheduleSideEffects: true,
      obligation: updatedObligation,
      obligationId: input.obligationId,
      paymentAuditPersistedIfAvailable: input.targetStatus === FinancialObligationStatus.PAID,
      paymentCreated: false,
      previousStatus,
      status: normalizeUpperText(readProperty(updatedObligation, "status")),
      targetStatus: input.targetStatus,
      updated: true,
    };
  }

  /**
   * @returns {{ findEnrollmentFinancialObligation: Function, createEnrollmentFinancialObligationRecord: Function }}
   */
  getFinancialObligationRepository() {
    if (
      typeof this.financialObligationRepository?.findEnrollmentFinancialObligation !== "function" ||
      typeof this.financialObligationRepository?.createEnrollmentFinancialObligationRecord !==
        "function"
    ) {
      throw new TypeError(
        "FinancialApplicationService requires a financialObligationRepository with find/create methods.",
      );
    }

    return this.financialObligationRepository;
  }

  /**
   * @returns {{ findEnrollmentFinancialObligationById: Function, updateEnrollmentFinancialObligationStatus: Function }}
   */
  getFinancialObligationStatusRepository() {
    if (
      typeof this.financialObligationRepository?.findEnrollmentFinancialObligationById !==
        "function" ||
      typeof this.financialObligationRepository?.updateEnrollmentFinancialObligationStatus !==
        "function"
    ) {
      throw new TypeError(
        "FinancialApplicationService requires a financialObligationRepository with find-by-id/update-status methods.",
      );
    }

    return this.financialObligationRepository;
  }

  /**
   * @returns {{ listEnrollmentFinancialObligations: Function, listEnrollmentFinancialObligationsByStudentScope: Function }}
   */
  getFinancialObligationAdminRepository() {
    if (
      typeof this.financialObligationRepository?.listEnrollmentFinancialObligations !==
        "function" ||
      typeof this.financialObligationRepository?.listEnrollmentFinancialObligationsByStudentScope !==
        "function"
    ) {
      throw new TypeError(
        "FinancialApplicationService requires a financialObligationRepository with admin read methods.",
      );
    }

    return this.financialObligationRepository;
  }

  /**
   * @returns {{ searchStudentScopes: Function }}
   */
  getFinancialStudentScopeReader() {
    if (typeof this.studentScopeReader?.searchStudentScopes !== "function") {
      throw new TypeError(
        "FinancialApplicationService requires a studentScopeReader.searchStudentScopes function.",
      );
    }

    return this.studentScopeReader;
  }

  /**
   * @returns {boolean}
   */
  hasFinancialObligationRepository() {
    return (
      typeof this.financialObligationRepository?.findEnrollmentFinancialObligation === "function" &&
      typeof this.financialObligationRepository?.createEnrollmentFinancialObligationRecord ===
        "function"
    );
  }

  /**
   * @param {string|null} enrollmentId
   * @returns {Promise<unknown|null>}
   */
  async findEnrollmentById(enrollmentId) {
    const reader = this.getEnrollmentReader();

    if (!enrollmentId) {
      return null;
    }

    if (typeof reader.findEnrollmentById === "function") {
      return reader.findEnrollmentById(enrollmentId);
    }

    return reader.findById(enrollmentId);
  }

  /**
   * @returns {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }}
   */
  getEnrollmentReader() {
    if (
      !this.enrollmentReader ||
      (
        typeof this.enrollmentReader.findEnrollmentById !== "function" &&
        typeof this.enrollmentReader.findById !== "function"
      )
    ) {
      throw new TypeError(
        "FinancialApplicationService requires an enrollmentReader.findEnrollmentById or findById function.",
      );
    }

    return this.enrollmentReader;
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async resolveBillingSource(input) {
    const reader = this.billingSourceReader;

    if (!reader) {
      return {};
    }

    if (typeof reader === "function") {
      return readObject(await reader(input));
    }

    const methods = [
      "prepareEnrollmentBillingContract",
      "resolveEnrollmentBillingContract",
      "findEnrollmentBillingContract",
      "findBillingContractForEnrollment",
      "findByEnrollmentId",
    ];

    for (const method of methods) {
      if (typeof reader[method] === "function") {
        return readObject(await reader[method](input));
      }
    }

    throw controlledError(
      "Billing source reader must expose a supported read method.",
      FINANCIAL_BILLING_SOURCE_READER_INVALID_CODE,
      { supportedMethods: methods },
    );
  }
}

/**
 * @param {unknown} enrollment
 * @param {Record<string, unknown>} input
 * @param {string[]} fields
 * @returns {string|null}
 */
function readEnrollmentStudentId(enrollment, input, fields) {
  for (const field of fields) {
    const value = nullableText(readProperty(enrollment, field), 64);

    if (value) {
      return value;
    }
  }

  for (const field of fields) {
    const value = nullableText(input[field], 64);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} input
 * @param {{ enrollmentId: string|null, studentPersonId: string|null, studentProfileId: string|null }} expected
 * @returns {void}
 */
function assertInputStudentMatchesEnrollment(input, expected) {
  const inputStudentPersonId = nullableText(input.studentPersonId ?? input.student_person_id, 64);
  const inputStudentProfileId = nullableText(input.studentProfileId ?? input.student_profile_id, 64);
  const personMismatch =
    inputStudentPersonId &&
    expected.studentPersonId &&
    inputStudentPersonId !== expected.studentPersonId;
  const profileMismatch =
    inputStudentProfileId &&
    expected.studentProfileId &&
    inputStudentProfileId !== expected.studentProfileId;

  if (!personMismatch && !profileMismatch) {
    return;
  }

  throw controlledError(
    "Enrollment billing contract input does not match the persisted Enrollment student ids.",
    FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH_CODE,
    {
      enrollmentId: expected.enrollmentId,
      expectedStudentPersonId: expected.studentPersonId,
      expectedStudentProfileId: expected.studentProfileId,
      inputStudentPersonId: inputStudentPersonId || null,
      inputStudentProfileId: inputStudentProfileId || null,
    },
  );
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
 * @returns {Record<string, unknown>}
 */
function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {string|null} enrollmentId
 * @returns {string}
 */
function buildInitialObligationIdempotencyKey(enrollmentId) {
  return `enrollment:${enrollmentId || "unknown"}:obligation:${INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE}`;
}

/**
 * @param {Record<string, unknown>} billingContract
 * @returns {Record<string, unknown>}
 */
function buildInitialObligationMetadata(billingContract) {
  return {
    billingContractVersion: nullableText(billingContract.contractVersion, 32),
    billingCycle: nullableText(billingContract.billingCycle, 32),
    classId: nullableText(billingContract.classId, 64),
    dueDay: Number.isInteger(billingContract.dueDay) ? billingContract.dueDay : null,
    noChargeCreated: true,
    noGatewayIntegration: true,
    noInstallmentCreated: true,
    noNotificationSideEffects: true,
    noPaymentCreated: true,
    noScheduleSideEffects: true,
    operation: "createInitialEnrollmentFinancialObligation",
  };
}

/**
 * @param {Record<string, unknown>} obligation
 * @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>}
 */
function buildFinancialObligationStatusMetadata(obligation, event) {
  const metadata = readObject(readProperty(obligation, "metadata"));
  const existingEvents = Array.isArray(metadata.statusAudit)
    ? metadata.statusAudit.filter((item) => item && typeof item === "object")
    : [];
  const statusEvent = compactObject({
    action: nullableText(event.action, 32),
    actor: nullableText(event.actor, 191),
    fromStatus: nullableText(event.previousStatus, 32),
    noGatewayIntegration: true,
    noNotificationSideEffects: true,
    noPaymentCreated: true,
    occurredAt: nullableText(event.occurredAt, 19),
    toStatus: nullableText(event.targetStatus, 32),
    ...compactObject(readObject(event.audit)),
  });

  return {
    ...metadata,
    noGatewayIntegration: true,
    noNotificationSideEffects: true,
    noPaymentCreated: true,
    statusAudit: [...existingEvents.slice(-19), statusEvent],
    statusFlowVersion: "sprint-12.7",
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {void}
 */
function assertFinancialObligationStatusTransition(input) {
  if (input.allowedCurrentStatuses.includes(input.previousStatus)) {
    return;
  }

  throw controlledError(
    "Enrollment financial obligation status transition is not allowed.",
    FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE,
    {
      allowedCurrentStatuses: input.allowedCurrentStatuses,
      currentStatus: input.previousStatus,
      obligationId: input.obligationId,
      targetStatus: input.targetStatus,
    },
  );
}

/**
 * @param {Record<string, unknown>[]} obligations
 * @returns {Record<string, unknown>}
 */
function buildFinancialObligationsSummary(obligations = []) {
  const summary = {
    amountCancelled: 0,
    amountOpen: 0,
    amountOverdue: 0,
    amountPaid: 0,
    amountTotal: 0,
    byStatus: {},
    cancelled: 0,
    open: 0,
    overdue: 0,
    paid: 0,
    total: obligations.length,
  };

  for (const obligation of obligations) {
    const status = normalizeUpperText(readProperty(obligation, "status")) || "UNKNOWN";
    const amount = Number(readProperty(obligation, "amount") || 0);
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;

    summary.byStatus[status] = Number(summary.byStatus[status] || 0) + 1;
    summary.amountTotal += normalizedAmount;

    if (status === FinancialObligationStatus.PAID) {
      summary.paid += 1;
      summary.amountPaid += normalizedAmount;
    } else if (status === FinancialObligationStatus.CANCELLED) {
      summary.cancelled += 1;
      summary.amountCancelled += normalizedAmount;
    } else {
      summary.open += 1;
      summary.amountOpen += normalizedAmount;

      if (status === FinancialObligationStatus.OVERDUE) {
        summary.overdue += 1;
        summary.amountOverdue += normalizedAmount;
      }
    }
  }

  for (const key of ["amountCancelled", "amountOpen", "amountOverdue", "amountPaid", "amountTotal"]) {
    summary[key] = Number(summary[key].toFixed(2));
  }

  return summary;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function compactObject(input) {
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== null && value !== undefined && value !== "") {
      output[key] = value;
    }
  }

  return output;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
function requiredInputText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw controlledError(
      `Financial obligation status flow requires ${field}.`,
      FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
      { field },
    );
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requiredDateTimeText(value, field) {
  const normalized = normalizeDateTime(value);

  if (!normalized) {
    throw controlledError(
      `Financial obligation status flow requires a valid ${field}.`,
      FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
      { field },
    );
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {number}
 */
function normalizeResultLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeDateTime(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const normalized = nullableText(value, 19);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized || "")) {
    return `${normalized} 00:00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized || "")) {
    return normalized.replace("T", " ");
  }

  return null;
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
  FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND_CODE,
  FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH_CODE,
  FINANCIAL_BILLING_SOURCE_READER_INVALID_CODE,
  FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
  FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE,
  FINANCIAL_OBLIGATION_NOT_FOUND_CODE,
  FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP_CODE,
  FINANCIAL_STUDENT_SCOPE_SEARCH_INPUT_REQUIRED_CODE,
  FinancialObligationStatus,
  FinancialApplicationService,
  INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
};
