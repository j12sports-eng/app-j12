const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentFacade } = require("../facades/enrollment.facade.js");
const {
  ENROLLMENT_AUDIT_INVALID_ACTION_CODE,
  ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED_CODE,
  EnrollmentNotificationEventType,
} = require("../contracts/index.js");

test("EnrollmentFacade delegates read and guard operations to the application service", async () => {
  const calls = [];
  const service = createDelegatingService(calls);
  const facade = new EnrollmentFacade({
    enrollmentService: service,
    eventDispatcher: { dispatch() {} },
  });

  assert.deepEqual(await facade.findCurrentDraftEnrollment({ scope: "draft" }), {
    delegated: "findCurrentDraftEnrollment",
    input: { scope: "draft" },
  });
  assert.deepEqual(await facade.findCurrentActiveEnrollment({ scope: "active" }), {
    delegated: "findCurrentActiveEnrollment",
    input: { scope: "active" },
  });
  assert.deepEqual(await facade.findEnrollmentById("enrollment-by-id"), {
    delegated: "findEnrollmentById",
    input: "enrollment-by-id",
  });
  assert.deepEqual(await facade.getEnrollmentStatusSummary({ scope: "status" }), {
    delegated: "getEnrollmentStatusSummary",
    input: { scope: "status" },
  });
  assert.deepEqual(await facade.ensureEnrollmentCanProceed({ scope: "proceed" }), {
    delegated: "ensureEnrollmentCanProceed",
    input: { scope: "proceed" },
  });
  assert.deepEqual(await facade.ensureNoActiveEnrollment({ scope: "no-active" }), {
    delegated: "ensureNoActiveEnrollment",
    input: { scope: "no-active" },
  });

  assert.deepEqual(
    calls.map((call) => call.method),
    [
      "findCurrentDraftEnrollment",
      "findCurrentActiveEnrollment",
      "findEnrollmentById",
      "getEnrollmentStatusSummary",
      "ensureEnrollmentCanProceed",
      "ensureNoActiveEnrollment",
    ],
  );
});

test("EnrollmentFacade delegates draft creation and emits draft-created event only when created", async () => {
  const events = [];
  const service = {
    async createDraftEnrollmentIdempotently(input) {
      return {
        created: input.create === true,
        draftEnrollment: {
          id: "draft-event",
          status: "DRAFT",
          studentPersonId: "person-event",
          studentProfileId: "profile-event",
        },
        reused: input.create !== true,
      };
    },
  };
  const facade = new EnrollmentFacade({
    clock: () => "2026-06-30T12:00:00.000Z",
    enrollmentService: service,
    eventDispatcher: {
      dispatch(event) {
        events.push(event);
      },
    },
  });

  const created = await facade.createDraftEnrollmentIdempotently({ create: true });
  const reused = await facade.createDraftEnrollmentIdempotently({ create: false });

  assert.equal(created.created, true);
  assert.equal(reused.reused, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "EnrollmentDraftCreated");
  assert.equal(events[0].enrollmentId, "draft-event");
  assert.equal(events[0].studentPersonId, "person-event");
  assert.equal(events[0].studentProfileId, "profile-event");
});

test("EnrollmentFacade delegates confirmation and emits confirmed event", async () => {
  const events = [];
  const facade = new EnrollmentFacade({
    clock: () => "2026-06-30T12:30:00.000Z",
    enrollmentService: {
      async confirmDraftEnrollment(input) {
        return {
          confirmed: true,
          enrollment: {
            id: input.enrollmentId,
            status: "ACTIVE",
            studentPersonId: "person-confirm",
            studentProfileId: "profile-confirm",
          },
          status: "ACTIVE",
        };
      },
    },
    eventDispatcher: {
      dispatch(event) {
        events.push(event);
      },
    },
  });

  const result = await facade.confirmDraftEnrollment({ enrollmentId: "confirmed-1" });

  assert.equal(result.confirmed, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "EnrollmentConfirmed");
  assert.equal(events[0].enrollmentId, "confirmed-1");
  assert.equal(events[0].status, "ACTIVE");
  assert.equal(events[0].metadata.operation, "confirmDraftEnrollment");
});

test("EnrollmentFacade exposes preparation-only contracts without service calls", () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService(calls),
    eventDispatcher: { dispatch() {} },
  });

  const classLink = facade.prepareEnrollmentClassLink({
    classId: 10,
    enrollmentId: "enrollment-class",
    requestedBy: "test",
  });
  const financialLink = facade.prepareEnrollmentFinancialLink({
    enrollmentId: "enrollment-financial",
    requestedBy: "test",
    studentPersonId: "person-financial",
    studentProfileId: "profile-financial",
  });

  assert.equal(classLink.prepared, true);
  assert.equal(classLink.blockedBySchemaOrModuleGap, true);
  assert.equal(classLink.linkCreated, false);
  assert.equal(classLink.requiresMigration, true);
  assert.equal(financialLink.prepared, true);
  assert.equal(financialLink.chargeCreated, false);
  assert.equal(financialLink.installmentCreated, false);
  assert.deepEqual(calls, []);
});

test("EnrollmentFacade exposes a preparation-only operational dashboard contract", () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService(calls),
    eventDispatcher: { dispatch() {} },
  });

  const dashboard = facade.getEnrollmentOperationalDashboard({
    endDate: "2026-06-30",
    generatedAt: "2026-06-30T15:00:00.000Z",
    startDate: "2026-06-01",
    unitId: "unit-1",
  });

  assert.equal(dashboard.prepared, true);
  assert.equal(dashboard.queryEnabled, false);
  assert.equal(dashboard.dashboardQueryCreated, false);
  assert.equal(dashboard.noDashboardQueryCreated, true);
  assert.equal(dashboard.blockedByDataOrPatternGap, true);
  assert.equal(dashboard.personalDataExposed, false);
  assert.equal(dashboard.totalDraft, null);
  assert.equal(dashboard.totalActive, null);
  assert.equal(dashboard.totalConflict, null);
  assert.equal(dashboard.totalConfirmedInPeriod, null);
  assert.equal(dashboard.conversionRate, null);
  assert.equal(dashboard.pendingDrafts, null);
  assert.equal(dashboard.filters.startDate, "2026-06-01");
  assert.equal(dashboard.filters.endDate, "2026-06-30");
  assert.equal(dashboard.filters.unitId, "unit-1");
  assert.equal(dashboard.filters.unitScopeSupported, false);
  assert.deepEqual(calls, []);
});

test("EnrollmentFacade blocks invalid operational dashboard date ranges", () => {
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  assert.throws(
    () =>
      facade.getEnrollmentOperationalDashboard({
        endDate: "2026-06-01",
        startDate: "2026-06-30",
      }),
    {
      code: ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE_CODE,
    },
  );
});

test("EnrollmentFacade exposes a preparation-only audit event contract", () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService(calls),
    eventDispatcher: { dispatch() {} },
  });

  const auditEvent = facade.recordEnrollmentAuditEvent({
    action: "DRAFT_CONFIRMED",
    actor: "admin@j12.local",
    enrollmentId: "enrollment-audit",
    metadata: {
      cpf: "123.456.789-10",
      reason: "manual-confirmation",
      retries: 1,
      stack: "hidden",
      token: "hidden",
    },
    occurredAt: "2026-06-30T15:00:00.000Z",
    requestId: "req-audit",
    studentPersonId: "person-audit",
    studentProfileId: "profile-audit",
  });

  assert.equal(auditEvent.prepared, true);
  assert.equal(auditEvent.persisted, false);
  assert.equal(auditEvent.auditTableCreated, false);
  assert.equal(auditEvent.noAuditTableCreated, true);
  assert.equal(auditEvent.auditPayloadSafe, true);
  assert.equal(auditEvent.action, "DRAFT_CONFIRMED");
  assert.equal(auditEvent.actor, "admin@j12.local");
  assert.equal(auditEvent.correlationId, "req-audit");
  assert.equal(auditEvent.metadata.reason, "manual-confirmation");
  assert.equal(auditEvent.metadata.retries, 1);
  assert.equal("cpf" in auditEvent.metadata, false);
  assert.equal("stack" in auditEvent.metadata, false);
  assert.equal("token" in auditEvent.metadata, false);
  assert.deepEqual(calls, []);
});

test("EnrollmentFacade blocks unsupported audit actions", () => {
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  assert.throws(
    () =>
      facade.recordEnrollmentAuditEvent({
        action: "UNKNOWN_ACTION",
        actor: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_AUDIT_INVALID_ACTION_CODE,
    },
  );
});

test("EnrollmentFacade prepares financial obligation through internal service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: {
      async findEnrollmentById(id) {
        calls.push(id);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-obligation",
          studentProfileId: "profile-obligation",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentFinancialObligation({
    enrollmentId: "active-obligation",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noFinancialEntryCreated, true);
  assert.deepEqual(calls, ["active-obligation"]);
});

test("EnrollmentFacade can delegate initial financial obligation creation to the service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentFinancialService: {
      async createInitialFinancialObligationForEnrollment(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.createInitialFinancialObligationForEnrollment({
    enrollmentId: "delegated-financial",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [{
    enrollmentId: "delegated-financial",
    requestedBy: "admin@j12.local",
  }]);
});

test("EnrollmentFacade prepares active Enrollment class link through internal service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentClassLinkService: {
      async prepareActiveEnrollmentClassLink(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareActiveEnrollmentClassLink({
    classId: 20,
    enrollmentId: "delegated-class",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      classId: 20,
      enrollmentId: "delegated-class",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade links an ACTIVE Enrollment to a class through internal service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentClassLinkService: {
      async linkActiveEnrollmentToClass(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.linkActiveEnrollmentToClass({
    classId: 20,
    enrollmentId: "delegated-class",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      classId: 20,
      enrollmentId: "delegated-class",
      linkedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade links through the default EnrollmentClassLinkService when dependencies are injected", async () => {
  const classFacadeCalls = [];
  const writes = [];
  const facade = new EnrollmentFacade({
    classFacade: {
      async findActiveClassById(input) {
        classFacadeCalls.push(["findActiveClassById", input]);
        return {
          id: input.classId,
          name: "Sub-17",
          status: "ativa",
        };
      },
      async ensureClassHasAvailableCapacity(input) {
        classFacadeCalls.push(["ensureClassHasAvailableCapacity", input]);
        return {
          availableSlots: 1,
          capacityTotal: 2,
          classId: Number(input.classId),
          hasAvailableCapacity: true,
          occupiedSlots: 1,
        };
      },
    },
    classLinkRepository: {
      async createActiveLinkIfNotExists(input) {
        writes.push(input);
        return {
          created: true,
          link: {
            classId: input.classId,
            enrollmentId: input.enrollmentId,
            id: "facade-link-1",
            linkedBy: input.linkedBy,
            status: "ACTIVE",
          },
          reused: false,
        };
      },
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    enrollmentService: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-facade-link",
          studentProfileId: "profile-facade-link",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.linkActiveEnrollmentToClass({
    classId: 25,
    enrollmentId: "facade-active-link",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, true);
  assert.equal(result.classValidation.classValidatedByFacade, true);
  assert.equal(result.link.id, "facade-link-1");
  assert.deepEqual(classFacadeCalls, [
    ["findActiveClassById", { classId: 25 }],
    ["ensureClassHasAvailableCapacity", { classId: 25 }],
  ]);
  assert.deepEqual(writes, [
    {
      classId: 25,
      enrollmentId: "facade-active-link",
      linkedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade passes transactionRunner to the default EnrollmentClassLinkService", async () => {
  const events = [];
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
    async transactionRunner(work) {
      events.push("begin");
      const result = await work({
        classFacade: {
          async findActiveClassById(input) {
            return {
              id: input.classId,
              name: "Sub-17",
              status: "ativa",
            };
          },
          async ensureClassHasAvailableCapacity(input) {
            return {
              availableSlots: 1,
              capacityTotal: 2,
              classId: Number(input.classId),
              hasAvailableCapacity: true,
              occupiedSlots: 1,
            };
          },
        },
        classLinkRepository: {
          async createActiveLinkIfNotExists(input) {
            return {
              created: true,
              link: {
                classId: input.classId,
                enrollmentId: input.enrollmentId,
                id: "tx-facade-link",
                linkedAt: "2026-07-01T10:00:00.000Z",
                linkedBy: input.linkedBy,
                status: "ACTIVE",
              },
              reused: false,
            };
          },
          async findActiveByEnrollmentAndClass() {
            return null;
          },
        },
        enrollmentReader: {
          async findEnrollmentById(id) {
            return {
              id,
              status: "ACTIVE",
            };
          },
        },
      });
      events.push("commit");
      return result;
    },
  });

  const result = await facade.linkActiveEnrollmentToClass({
    classId: 26,
    enrollmentId: "facade-active-link-tx",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.transactional, true);
  assert.equal(result.linkAuditPersisted, true);
  assert.equal(result.link.id, "tx-facade-link");
  assert.deepEqual(events, ["begin", "commit"]);
});

test("EnrollmentFacade prepares schedule link through internal service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: {
      async findEnrollmentById(id) {
        calls.push(id);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-schedule",
          studentProfileId: "profile-schedule",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentScheduleLink({
    classId: 20,
    enrollmentId: "active-schedule",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.scheduleCreated, false);
  assert.equal(result.financialSideEffects, false);
  assert.equal(result.notificationSideEffects, false);
  assert.equal(result.scheduleCreationBlockedBySchemaOrModuleGap, true);
  assert.deepEqual(calls, ["active-schedule"]);
});

test("EnrollmentFacade prepares initial schedule through default service with injected readers", async () => {
  const facade = new EnrollmentFacade({
    classLinkRepository: {
      async findActiveByEnrollmentAndClass(input) {
        return {
          classId: input.classId,
          enrollmentId: input.enrollmentId,
          id: "facade-class-link-schedule",
          status: "ACTIVE",
        };
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          dias_semana_json: "[\"terca\",\"quinta\"]",
          horario_fim: "20:00",
          horario_inicio: "19:00",
          id,
          status: "ativa",
        };
      },
    },
    enrollmentService: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-initial-schedule",
          studentProfileId: "profile-initial-schedule",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.createInitialScheduleForEnrollment({
    classId: 33,
    enrollmentId: "active-initial-schedule",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.enrollmentSchedulePrepared, true);
  assert.equal(result.activeClassLinkFound, true);
  assert.equal(result.classScheduleMapped, true);
  assert.equal(result.scheduleCreated, false);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
});

test("EnrollmentFacade prepares notification through internal service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: {
      async findEnrollmentById(id) {
        calls.push(id);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-notification",
          studentProfileId: "profile-notification",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentNotification({
    enrollmentId: "active-notification",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.notificationCreated, false);
  assert.equal(result.emailSent, false);
  assert.equal(result.whatsappSent, false);
  assert.equal(result.pushSent, false);
  assert.equal(result.safePayload, true);
  assert.deepEqual(calls, ["active-notification"]);
});

test("EnrollmentFacade prepares notification from event through default service", async () => {
  const facade = new EnrollmentFacade({
    enrollmentService: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-event-notification",
          studentProfileId: "profile-event-notification",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentNotificationFromEvent({
    enrollmentId: "event-notification",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_SCHEDULE_CREATED,
    occurredAt: "2026-07-01T13:00:00.000Z",
    payload: {
      cpf: "111.222.333-44",
      token: "private",
    },
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.notificationPreparedFromEvent, true);
  assert.equal(result.notificationCreated, false);
  assert.equal(result.safePayload, true);
  assert.equal(result.noEmailSent, true);
  assert.equal(result.noWhatsappSent, true);
  assert.equal(result.noPushSent, true);
  assert.equal(JSON.stringify(result).includes("111.222.333-44"), false);
});

test("EnrollmentFacade returns a student/mobile-safe Enrollment summary", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentService: {
      async getEnrollmentStatusSummary(input) {
        calls.push(input);

        return {
          activeEnrollment: {
            confirmedAt: "2026-06-30T12:00:00.000Z",
            confirmedBy: "admin@j12.local",
            createdAt: "2026-06-30T11:00:00.000Z",
            id: "active-mobile",
            startDate: "2026-06-30",
            status: "ACTIVE",
            studentPersonId: "person-mobile",
            studentProfileId: "profile-mobile",
            updatedAt: "2026-06-30T12:00:00.000Z",
          },
          draftEnrollment: null,
          hasActiveEnrollment: true,
          hasDraftEnrollment: false,
          status: "ACTIVE",
        };
      },
    },
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.getStudentEnrollmentMobileSummary({
    studentPersonId: "person-mobile",
    studentProfileId: "profile-mobile",
  });

  assert.deepEqual(calls, [
    {
      studentPersonId: "person-mobile",
      studentProfileId: "profile-mobile",
    },
  ]);
  assert.equal(result.mobileSafe, true);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.enrollmentId, "active-mobile");
  assert.equal(result.classSummary, null);
  assert.equal(result.scheduleSummary, null);
  assert.equal(result.financialSummary, null);
  assert.equal(result.availableActions.canConfirmEnrollment, false);
  assert.equal(result.currentEnrollmentSummary.enrollmentId, "active-mobile");
  assert.equal("confirmedAt" in result.currentEnrollmentSummary, false);
  assert.equal("confirmedBy" in result.currentEnrollmentSummary, false);
  assert.equal("createdAt" in result.currentEnrollmentSummary, false);
  assert.equal("studentPersonId" in result.currentEnrollmentSummary, false);
  assert.equal("studentProfileId" in result.currentEnrollmentSummary, false);
  assert.equal("studentPersonId" in result, false);
  assert.equal("studentProfileId" in result, false);
  assert.deepEqual(result.historySummary, [
    {
      endDate: null,
      enrollmentId: "active-mobile",
      startDate: "2026-06-30",
      status: "ACTIVE",
    },
  ]);
});

test("EnrollmentFacade blocks mobile summary reads without scoped student identifiers", async () => {
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  await assert.rejects(
    () =>
      facade.getStudentEnrollmentMobileSummary({
        studentPersonId: "person-mobile",
      }),
    {
      code: ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED_CODE,
    },
  );
});

test("EnrollmentFacade can use an injected notification preparation service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentNotificationService: {
      async prepareEnrollmentNotification(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentNotification({
    enrollmentId: "delegated-notification",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      enrollmentId: "delegated-notification",
      eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade can use an injected notification-from-event preparation service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentNotificationService: {
      async prepareEnrollmentNotification(input) {
        return input;
      },
      async prepareEnrollmentNotificationFromEvent(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentNotificationFromEvent({
    enrollmentId: "delegated-notification-event",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      enrollmentId: "delegated-notification-event",
      eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade can use an injected schedule preparation service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentScheduleService: {
      async prepareEnrollmentScheduleLink(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentScheduleLink({
    classId: 20,
    enrollmentId: "delegated-schedule",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      classId: 20,
      enrollmentId: "delegated-schedule",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade can use an injected initial schedule preparation service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentScheduleService: {
      async createInitialScheduleForEnrollment(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
      async prepareEnrollmentScheduleLink(input) {
        return input;
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.createInitialScheduleForEnrollment({
    classId: 20,
    enrollmentId: "delegated-initial-schedule",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      classId: 20,
      enrollmentId: "delegated-initial-schedule",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade can use an injected financial preparation service", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentFinancialService: {
      async prepareEnrollmentFinancialObligation(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  const result = await facade.prepareEnrollmentFinancialObligation({
    enrollmentId: "delegated-obligation",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      enrollmentId: "delegated-obligation",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("EnrollmentFacade blocks class link preparation for DRAFT enrollment and inactive class", () => {
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  assert.throws(
    () =>
      facade.prepareEnrollmentClassLink({
        classId: 10,
        enrollmentId: "draft-class",
        enrollmentStatus: "DRAFT",
        requestedBy: "test",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
    },
  );

  assert.throws(
    () =>
      facade.prepareEnrollmentClassLink({
        classId: 10,
        classStatus: "inativa",
        enrollmentId: "active-class",
        enrollmentStatus: "ACTIVE",
        requestedBy: "test",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
    },
  );
});

test("EnrollmentFacade blocks financial link preparation for DRAFT enrollment", () => {
  const facade = new EnrollmentFacade({
    enrollmentService: createDelegatingService([]),
    eventDispatcher: { dispatch() {} },
  });

  assert.throws(
    () =>
      facade.prepareEnrollmentFinancialLink({
        enrollmentId: "draft-financial",
        enrollmentStatus: "DRAFT",
        requestedBy: "test",
        studentPersonId: "person-financial",
        studentProfileId: "profile-financial",
      }),
    {
      code: ENROLLMENT_FINANCIAL_LINK_INVALID_ENROLLMENT_STATUS_CODE,
    },
  );
});

function createDelegatingService(calls) {
  function record(method, input) {
    calls.push({ input, method });
    return Promise.resolve({
      delegated: method,
      input,
    });
  }

  return {
    ensureEnrollmentCanProceed(input) {
      return record("ensureEnrollmentCanProceed", input);
    },
    ensureNoActiveEnrollment(input) {
      return record("ensureNoActiveEnrollment", input);
    },
    findCurrentActiveEnrollment(input) {
      return record("findCurrentActiveEnrollment", input);
    },
    findCurrentDraftEnrollment(input) {
      return record("findCurrentDraftEnrollment", input);
    },
    findEnrollmentById(id) {
      return record("findEnrollmentById", id);
    },
    getEnrollmentStatusSummary(input) {
      return record("getEnrollmentStatusSummary", input);
    },
  };
}
test("EnrollmentFacade delegates cancelEnrollment command and context unchanged", async () => {
  const calls = [];
  const service = {
    async cancelEnrollment(command, context) {
      calls.push({ command, context });
      return { enrollmentId: "enrollment-facade", status: "CANCELLED" };
    },
  };
  const facade = new EnrollmentFacade({ enrollmentApplicationService: service });
  const command = Object.freeze({ enrollmentId: "enrollment-facade" });
  const context = Object.freeze({ actorId: "actor-facade", authorization: Object.freeze({ allowed: true }) });

  const result = await facade.cancelEnrollment(command, context);

  assert.deepEqual(result, { enrollmentId: "enrollment-facade", status: "CANCELLED" });
  assert.deepEqual(calls, [{ command, context }]);
});
