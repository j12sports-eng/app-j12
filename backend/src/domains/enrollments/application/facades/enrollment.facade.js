const { EnrollmentApplicationService } = require("../services/enrollment-application.service.js");
const { EnrollmentClassLinkService } = require("../services/enrollment-class-link.service.js");
const { EnrollmentFinancialService } = require("../services/enrollment-financial.service.js");
const { EnrollmentNotificationService } = require("../services/enrollment-notification.service.js");
const { EnrollmentScheduleService } = require("../services/enrollment-schedule.service.js");
const {
  StudentEnrollmentApplicationService,
} = require("../services/student-enrollment-application.service.js");
const {
  assertStudentEnrollmentMobileScope,
  prepareEnrollmentOperationalDashboard,
  prepareEnrollmentClassLink,
  prepareEnrollmentFinancialLink,
  prepareStudentEnrollmentMobileSummary,
  recordEnrollmentAuditEvent,
} = require("../contracts/index.js");
const {
  EnrollmentConfirmed,
  EnrollmentDraftCreated,
  EnrollmentInternalEventDispatcher,
  readEnrollmentEventData,
} = require("../events/index.js");

/**
 * Facade for internal Enrollment application operations.
 *
 * It is intentionally thin: callers use this single entrypoint while business
 * rules stay inside the existing application services.
 * Sprint 9.42 emits internal Enrollment events after successful controlled
 * state changes without triggering external integrations.
 * Sprint 9.43 exposes a preparation-only contract for future Enrollment ->
 * Turma linking.
 * Sprint 9.50 keeps the Turma link preparation blocked until a dedicated
 * Enrollment -> Turma schema exists.
 * Sprint 9.44 exposes a preparation-only contract for future Enrollment ->
 * Financeiro linking.
 * Sprint 9.51 validates ACTIVE persisted Enrollments before preparing a future
 * financial obligation contract without creating charges.
 * Sprint 9.52 validates ACTIVE persisted Enrollments before preparing a future
 * Agenda/schedule contract without creating schedules or notifications.
 * Sprint 9.53 validates persisted Enrollment events before preparing future
 * Notificacoes contracts without creating or sending notifications.
 * Sprint 9.56 exposes a student/mobile-safe Enrollment summary DTO without
 * creating mobile routes or exposing administrative data.
 * Sprint 9.57 exposes a preparation-only operational dashboard contract
 * without aggregate queries until unit scope and performance gaps are closed.
 * Sprint 9.58 exposes a preparation-only audit event contract without creating
 * audit tables or persisting sensitive payloads.
 * Sprint 10.2 exposes a no-write Enrollment -> Turma preparation service that
 * validates ACTIVE Enrollments and documents the missing safe Turma link table.
 * Sprint 10.7 prepares initial Agenda creation from an ACTIVE Enrollment
 * linked to a Turma, without creating schedule rows.
 * Sprint 10.8 prepares notification contracts from Enrollment events without
 * creating or sending notifications.
 */
class EnrollmentFacade {
  /**
   * @param {Object} [options]
   * @param {EnrollmentApplicationService} [options.enrollmentService]
   * @param {EnrollmentApplicationService} [options.enrollmentApplicationService]
   * @param {{ createDraft: (input: Record<string, unknown>) => unknown }} [options.enrollmentFactory]
   * @param {Record<string, unknown>} [options.enrollmentRepository]
   * @param {{ findActiveClassById?: (input: Record<string, unknown>) => Promise<unknown|null>, ensureClassHasAvailableCapacity?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }} [options.classFacade]
   * @param {(work: (context?: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>} [options.transactionRunner]
   * @param {{ dispatch?: (event: Record<string, unknown>) => Promise<unknown>|unknown, publish?: (event: Record<string, unknown>) => Promise<unknown>|unknown }} [options.eventDispatcher]
   * @param {{ prepareEnrollmentFinancialObligation?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }} [options.enrollmentFinancialService]
   * @param {{ prepareActiveEnrollmentClassLink?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }} [options.enrollmentClassLinkService]
   * @param {{ prepareEnrollmentNotification?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>, prepareEnrollmentNotificationFromEvent?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }} [options.enrollmentNotificationService]
   * @param {{ prepareEnrollmentScheduleLink?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>, createInitialScheduleForEnrollment?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }} [options.enrollmentScheduleService]
   * @param {{ error?: (message: string, context?: Record<string, unknown>) => void, info?: (message: string, context?: Record<string, unknown>) => void, warn?: (message: string, context?: Record<string, unknown>) => void }} [options.eventLogger]
   * @param {() => string} [options.clock]
   */
  constructor(options = {}) {
    const injectedService = options.enrollmentService || options.enrollmentApplicationService;

    this.clock = typeof options.clock === "function" ? options.clock : nowIso;
    this.eventLogger = options.eventLogger || options.logger || console;
    this.enrollmentService =
      injectedService ||
      new EnrollmentApplicationService({
        authorizeEnrollmentCancellation: options.authorizeEnrollmentCancellation,
        enrollmentFactory: options.enrollmentFactory,
        enrollmentRepository: options.enrollmentRepository,
      });
    this.enrollmentClassLinkService =
      options.enrollmentClassLinkService ||
      new EnrollmentClassLinkService({
        authorizeClassAssignment: options.authorizeClassAssignment || null,
        classFacade: options.classFacade || null,
        classLinkRepository: options.classLinkRepository || null,
        classReader: options.classReader || null,
        clock: options.assignmentClock,
        enrollmentReader: this.enrollmentService,
        logger: this.eventLogger,
        transactionRunner: options.transactionRunner || null,
      });
    this.enrollmentFinancialService =
      options.enrollmentFinancialService ||
      new EnrollmentFinancialService({
        enrollmentReader: this.enrollmentService,
      });
    this.enrollmentNotificationService =
      options.enrollmentNotificationService ||
      new EnrollmentNotificationService({
        enrollmentReader: this.enrollmentService,
      });
    this.enrollmentScheduleService =
      options.enrollmentScheduleService ||
      new EnrollmentScheduleService({
        classLinkReader: options.classLinkReader || options.classLinkRepository || null,
        classReader: options.classReader || null,
        enrollmentReader: this.enrollmentService,
      });
    this.eventDispatcher =
      options.eventDispatcher ||
      new EnrollmentInternalEventDispatcher({
        logger: this.eventLogger,
      });
    this.studentEnrollmentApplicationService =
      options.studentEnrollmentApplicationService ||
      new StudentEnrollmentApplicationService({
        enrollmentApplicationService: this.enrollmentService,
        studentApplicationService: options.studentApplicationService || null,
      });
    this.enrollmentInvitationAdminService = options.enrollmentInvitationAdminService || null;
  }

  /** Canonical modern entrypoint: Pessoa -> Aluno profile -> DRAFT Enrollment. */
  resolveStudentAndCreateDraftEnrollment(input = {}, context = {}) {
    return this.studentEnrollmentApplicationService.resolveStudentAndCreateDraftEnrollment(
      input,
      context,
    );
  }

  /** DRAFT entrypoint for callers that already hold canonical Pessoa/Aluno ids. */
  resolveOrCreateDraftEnrollmentForResolvedStudent(input = {}, context = {}) {
    return this.studentEnrollmentApplicationService.resolveOrCreateDraftEnrollmentForResolvedStudent(
      input,
      context,
    );
  }

  /**
   * @param {Object} input
   * @param {Object} actorContext
   * @returns {Promise<unknown>}
   */
  openDraftEnrollment(input = {}, actorContext = {}) {
    const service = this.getEnrollmentService();
    if (typeof service.openDraftEnrollment !== "function") {
      throw new TypeError("EnrollmentFacade requires openDraftEnrollment.");
    }
    return service.openDraftEnrollment(input, actorContext);
  }

  createDigitalEnrollmentInvitation(input = {}, actorContext = {}) {
    const service = this.enrollmentInvitationAdminService;
    if (typeof service?.createDigitalEnrollmentInvitation !== "function") {
      throw new TypeError("EnrollmentFacade requires createDigitalEnrollmentInvitation.");
    }
    return service.createDigitalEnrollmentInvitation(input, actorContext);
  }

  createDraftEnrollment(input = {}, context = {}) {
    return this.getEnrollmentService().createDraftEnrollment(input, context);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown>}
   */
  async createDraftEnrollmentAndPersist(input = {}, context = {}) {
    const service = this.getEnrollmentService();

    if (typeof service.createDraftEnrollmentIdempotently === "function") {
      const result = await service.createDraftEnrollmentIdempotently(input, context);

      await this.emitDraftCreatedEventWhenNeeded(result, "createDraftEnrollmentAndPersist");

      return result.draftEnrollment;
    }

    return service.createDraftEnrollmentAndPersist(input, context);
  }

  /**
   * @param {Object} input
   * @returns {Promise<{ draftEnrollment: unknown|null, created: boolean, reused: boolean }>}
   */
  async createDraftEnrollmentIdempotently(input = {}, context = {}) {
    const result = await this.getEnrollmentService().createDraftEnrollmentIdempotently(
      input,
      context,
    );

    await this.emitDraftCreatedEventWhenNeeded(result, "createDraftEnrollmentIdempotently");

    return result;
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown|null>}
   */
  findCurrentDraftEnrollment(input = {}) {
    return this.getEnrollmentService().findCurrentDraftEnrollment(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown|null>}
   */
  findDraftEnrollment(input = {}) {
    return this.getEnrollmentService().findDraftEnrollment(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown|null>}
   */
  findCurrentActiveEnrollment(input = {}) {
    return this.getEnrollmentService().findCurrentActiveEnrollment(input);
  }

  /**
   * Finds a persisted Enrollment by id through the official Enrollment facade.
   * Cross-domain consumers must use this method instead of reaching the
   * repository or application service directly.
   *
   * @param {string|null} id
   * @returns {Promise<unknown|null>}
   */
  findEnrollmentById(id = null) {
    return this.getEnrollmentService().findEnrollmentById(id);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown|null>}
   */
  getEnrollmentStatusSummary(input = {}) {
    return this.getEnrollmentService().getEnrollmentStatusSummary(input);
  }

  /**
   * Searches administrative Aluno Pessoa/Profile scopes for Enrollment status
   * queries without exposing repository details to controllers.
   *
   * @param {Object} input
   * @returns {Promise<unknown[]>}
   */
  searchStudentScopes(input = {}) {
    return this.getEnrollmentService().searchStudentScopes(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown>}
   */
  ensureEnrollmentCanProceed(input = {}) {
    return this.getEnrollmentService().ensureEnrollmentCanProceed(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<unknown>}
   */
  ensureNoActiveEnrollment(input = {}) {
    return this.getEnrollmentService().ensureNoActiveEnrollment(input);
  }

  /**
   * Prepares a future Enrollment -> Turma link without persisting any link.
   *
   * @param {Object} input
   * @returns {Record<string, unknown>}
   */
  prepareEnrollmentClassLink(input = {}) {
    return prepareEnrollmentClassLink(input);
  }

  /**
   * Prepares the first safe Enrollment -> Turma integration path after
   * validating a persisted ACTIVE Enrollment. No Turma or Aluno row is updated.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareActiveEnrollmentClassLink(input = {}) {
    return this.getEnrollmentClassLinkService().prepareActiveEnrollmentClassLink(input);
  }

  /**
   * Persists an ACTIVE Enrollment -> class link after validation.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  linkActiveEnrollmentToClass(input = {}) {
    return this.getEnrollmentClassLinkService().linkActiveEnrollmentToClass(input);
  }

  /**
   * Canonical authorized Enrollment -> Turma assignment boundary.
   *
   * @param {{ enrollmentId?: string|null, classId?: string|number|null }} command
   * @param {{ actorId?: string|null, authorization?: unknown, correlationId?: string|null, requestId?: string|null }} context
   * @returns {Promise<Readonly<Record<string, unknown>>>}
   */
  assignEnrollmentToClass(command = {}, context = {}) {
    const service = this.getEnrollmentClassLinkService();

    if (typeof service.assignEnrollmentToClass !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentClassLinkService.assignEnrollmentToClass function.",
      );
    }

    return service.assignEnrollmentToClass(command, context);
  }

  /**
   * Explicit canonical Enrollment -> Turma transfer boundary.
   *
   * @param {{ enrollmentId?: string|null, targetClassId?: string|number|null }} command
   * @param {{ actorId?: string|null, authorization?: unknown, correlationId?: string|null, requestId?: string|null }} context
   * @returns {Promise<Readonly<Record<string, unknown>>>}
   */
  transferEnrollmentToClass(command = {}, context = {}) {
    const service = this.getEnrollmentClassLinkService();

    if (typeof service.transferEnrollmentToClass !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentClassLinkService.transferEnrollmentToClass function.",
      );
    }

    return service.transferEnrollmentToClass(command, context);
  }

  /**
   * Explicit canonical Enrollment -> Turma reactivation boundary.
   *
   * @param {{ enrollmentId?: string|null, classId?: string|number|null }} command
   * @param {{ actorId?: string|null, authorization?: unknown }} context
   * @returns {Promise<Readonly<Record<string, unknown>>>}
   */
  reactivateEnrollmentClassLink(command = {}, context = {}) {
    const service = this.getEnrollmentClassLinkService();

    if (typeof service.reactivateEnrollmentClassLink !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentClassLinkService.reactivateEnrollmentClassLink function.",
      );
    }

    return service.reactivateEnrollmentClassLink(command, context);
  }
  /**
   * Prepares a future Enrollment -> Financeiro link without creating charges.
   *
   * @param {Object} input
   * @returns {Record<string, unknown>}
   */
  prepareEnrollmentFinancialLink(input = {}) {
    return prepareEnrollmentFinancialLink(input);
  }

  /**
   * Prepares the internal operational Enrollment dashboard contract.
   *
   * No aggregate query, route, UI, schema change or personal data exposure is
   * created here. Real totals stay blocked until unit/tenant scope and
   * performance requirements are closed.
   *
   * @param {Object} input
   * @returns {Record<string, unknown>}
   */
  getEnrollmentOperationalDashboard(input = {}) {
    return prepareEnrollmentOperationalDashboard(input);
  }

  /**
   * Prepares a safe Enrollment audit event payload without persistence.
   *
   * This method intentionally does not write to database or emit external logs.
   * It provides the normalized contract for future audit infrastructure.
   *
   * @param {Object} input
   * @returns {Record<string, unknown>}
   */
  recordEnrollmentAuditEvent(input = {}) {
    return recordEnrollmentAuditEvent(input);
  }

  /**
   * Returns a future app/mobile-safe Enrollment summary for a single scoped
   * student/profile pair. No admin audit data or related module data is exposed.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getStudentEnrollmentMobileSummary(input = {}) {
    const scope = assertStudentEnrollmentMobileScope(input);
    const statusSummary = await this.getEnrollmentService().getEnrollmentStatusSummary(scope);

    return prepareStudentEnrollmentMobileSummary({ statusSummary });
  }

  /**
   * Prepares a future Enrollment -> Financeiro obligation after validating a
   * persisted ACTIVE Enrollment. No charge, installment or payment is created.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareEnrollmentFinancialObligation(input = {}) {
    return this.getEnrollmentFinancialService().prepareEnrollmentFinancialObligation(input);
  }

  /**
   * Prepares an initial financial obligation for an ACTIVE Enrollment without
   * creating real financial records.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  createInitialFinancialObligationForEnrollment(input = {}) {
    return this.getEnrollmentFinancialService().createInitialFinancialObligationForEnrollment(
      input,
    );
  }

  /**
   * Prepares a future Enrollment -> Agenda schedule link after validating a
   * persisted ACTIVE Enrollment. No schedule, attendance, financial entry or
   * notification is created.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareEnrollmentScheduleLink(input = {}) {
    return this.getEnrollmentScheduleService().prepareEnrollmentScheduleLink(input);
  }

  /**
   * Prepares initial Agenda creation for an ACTIVE Enrollment linked to a Turma.
   * No schedule, attendance, financial entry or notification is created.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  createInitialScheduleForEnrollment(input = {}) {
    const service = this.getEnrollmentScheduleService();

    if (typeof service.createInitialScheduleForEnrollment !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentScheduleService.createInitialScheduleForEnrollment function.",
      );
    }

    return service.createInitialScheduleForEnrollment(input);
  }

  /**
   * Prepares a future Enrollment -> Notificacoes event after validating a
   * persisted Enrollment. No notification, Socket.IO event, e-mail, WhatsApp or
   * push message is created.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareEnrollmentNotification(input = {}) {
    return this.getEnrollmentNotificationService().prepareEnrollmentNotification(input);
  }

  /**
   * Prepares a future Notificacoes contract from an internal Enrollment event.
   * No notification, Socket.IO event, e-mail, WhatsApp or push message is sent.
   *
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareEnrollmentNotificationFromEvent(input = {}) {
    const service = this.getEnrollmentNotificationService();

    if (typeof service.prepareEnrollmentNotificationFromEvent !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentNotificationService.prepareEnrollmentNotificationFromEvent function.",
      );
    }

    return service.prepareEnrollmentNotificationFromEvent(input);
  }

  /**
   * Canonical administrative Enrollment cancellation boundary.
   *
   * @param {{ enrollmentId?: string|null }} command
   * @param {{ actorId?: string|null, authorization?: unknown, correlationId?: string|null, requestId?: string|null }} context
   * @returns {Promise<Readonly<Record<string, unknown>>>}
   */
  cancelEnrollment(command = {}, context = {}) {
    const service = this.getEnrollmentService();

    if (typeof service.cancelEnrollment !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentService.cancelEnrollment function.",
      );
    }

    return service.cancelEnrollment(command, context);
  }
  /**
   * @param {Object} input
   * @param {Object} context
   * @returns {Promise<unknown>}
   */
  async confirmDraftEnrollment(input = {}, context = {}) {
    const result = await this.getEnrollmentService().confirmDraftEnrollment(input, context);

    await this.emitEnrollmentConfirmedEventWhenNeeded(result);

    return result;
  }

  /**
   * @returns {EnrollmentApplicationService}
   */
  getEnrollmentService() {
    if (!this.enrollmentService || typeof this.enrollmentService !== "object") {
      throw new TypeError("EnrollmentFacade requires an enrollment application service.");
    }

    return this.enrollmentService;
  }

  /**
   * @returns {{ prepareEnrollmentFinancialObligation: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }}
   */
  getEnrollmentFinancialService() {
    if (!this.enrollmentFinancialService || typeof this.enrollmentFinancialService !== "object") {
      throw new TypeError("EnrollmentFacade requires an enrollmentFinancialService object.");
    }

    return this.enrollmentFinancialService;
  }

  /**
   * @returns {{ prepareActiveEnrollmentClassLink: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }}
   */
  getEnrollmentClassLinkService() {
    if (!this.enrollmentClassLinkService || typeof this.enrollmentClassLinkService !== "object") {
      throw new TypeError("EnrollmentFacade requires an enrollmentClassLinkService object.");
    }

    return this.enrollmentClassLinkService;
  }

  /**
   * @returns {{ prepareEnrollmentNotification: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }}
   */
  getEnrollmentNotificationService() {
    if (typeof this.enrollmentNotificationService?.prepareEnrollmentNotification !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentNotificationService.prepareEnrollmentNotification function.",
      );
    }

    return this.enrollmentNotificationService;
  }

  /**
   * @returns {{ prepareEnrollmentScheduleLink: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }}
   */
  getEnrollmentScheduleService() {
    if (typeof this.enrollmentScheduleService?.prepareEnrollmentScheduleLink !== "function") {
      throw new TypeError(
        "EnrollmentFacade requires an enrollmentScheduleService.prepareEnrollmentScheduleLink function.",
      );
    }

    return this.enrollmentScheduleService;
  }

  /**
   * @param {{ created?: boolean, draftEnrollment?: unknown, enrollment?: unknown }} result
   * @param {string} operation
   * @returns {Promise<void>}
   */
  async emitDraftCreatedEventWhenNeeded(result = {}, operation = "unknown") {
    if (!result?.created) {
      return;
    }

    const draftEnrollment = result.draftEnrollment ?? result.enrollment ?? null;

    if (!draftEnrollment) {
      return;
    }

    const payload = readEnrollmentEventData(draftEnrollment);
    const event = new EnrollmentDraftCreated({
      ...payload,
      metadata: {
        operation,
      },
      occurredAt: this.clock(),
      status: payload.status || "DRAFT",
    });

    await this.dispatchInternalEvent(event);
  }

  /**
   * @param {{ confirmed?: boolean, enrollment?: unknown }} result
   * @returns {Promise<void>}
   */
  async emitEnrollmentConfirmedEventWhenNeeded(result = {}) {
    if (!result?.confirmed || !result?.enrollment) {
      return;
    }

    const payload = readEnrollmentEventData(result.enrollment);
    const event = new EnrollmentConfirmed({
      ...payload,
      metadata: {
        operation: "confirmDraftEnrollment",
      },
      occurredAt: this.clock(),
      status: payload.status || result.status || "ACTIVE",
    });

    await this.dispatchInternalEvent(event);
  }

  /**
   * @param {{ toJSON?: () => Record<string, unknown> }} event
   * @returns {Promise<void>}
   */
  async dispatchInternalEvent(event) {
    const payload = typeof event?.toJSON === "function" ? event.toJSON() : event;

    try {
      if (typeof this.eventDispatcher?.dispatch === "function") {
        await this.eventDispatcher.dispatch(payload);
        return;
      }

      if (typeof this.eventDispatcher?.publish === "function") {
        await this.eventDispatcher.publish(payload);
      }
    } catch (error) {
      this.logEventDispatchFailure(error, payload);
    }
  }

  /**
   * @param {unknown} error
   * @param {Record<string, unknown>} event
   * @returns {void}
   */
  logEventDispatchFailure(error, event = {}) {
    const logger = this.eventLogger;

    if (typeof logger?.warn === "function") {
      logger.warn("[enrollments] Internal event dispatch failed.", {
        enrollmentId: event?.enrollmentId ?? null,
        errorMessage: error instanceof Error ? error.message : String(error ?? "Unknown error"),
        type: event?.type ?? null,
      });
      return;
    }

    if (typeof logger?.error === "function") {
      logger.error("[enrollments] Internal event dispatch failed.", {
        enrollmentId: event?.enrollmentId ?? null,
        errorMessage: error instanceof Error ? error.message : String(error ?? "Unknown error"),
        type: event?.type ?? null,
      });
    }
  }
}

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  EnrollmentFacade,
};
