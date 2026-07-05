const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE,
  AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE,
  AGENDA_ENROLLMENT_ID_REQUIRED_CODE,
  AGENDA_ENROLLMENT_NOT_ACTIVE_CODE,
  AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND_CODE,
  AGENDA_INITIAL_CLASS_LINK_REQUIRED_CODE,
  AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED_CODE,
  AGENDA_INITIAL_CREATION_SCHEMA_GAP_CODE,
  AGENDA_INITIAL_IDEMPOTENCY_GAP_CODE,
  AgendaApplicationService,
} = require("../services/agenda-application.service.js");

test("AgendaApplicationService returns empty lists for invalid input without touching repository", async () => {
  let calls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        calls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        calls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        calls += 1;
        return [];
      },
    },
  });

  assert.deepEqual(await service.findSchedulesByClass({ classId: "abc" }), []);
  assert.deepEqual(await service.findSchedulesByEnrollment({ enrollmentId: "" }), []);
  assert.deepEqual(
    await service.findSchedulesByStudent({
      studentPersonId: "person-1",
      studentProfileId: "",
    }),
    [],
  );
  assert.equal(calls, 0);
});

test("AgendaApplicationService delegates read-only schedule lookups to repository", async () => {
  const calls = [];
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass(input) {
        calls.push(["findSchedulesByClass", input]);
        return [{ classId: input.classId, readOnly: true }];
      },
      async findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return [{ enrollmentId: input.enrollmentId, readOnly: true }];
      },
      async findSchedulesByStudent(input) {
        calls.push(["findSchedulesByStudent", input]);
        return [{ studentPersonId: input.studentPersonId, readOnly: true }];
      },
    },
  });

  assert.deepEqual(await service.findSchedulesByClass({ classId: "7" }), [
    { classId: 7, readOnly: true },
  ]);
  assert.deepEqual(await service.findSchedulesByEnrollment({ enrollmentId: "enr-1" }), [
    { enrollmentId: "enr-1", readOnly: true },
  ]);
  assert.deepEqual(
    await service.findSchedulesByStudent({
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
    }),
    [{ readOnly: true, studentPersonId: "person-1" }],
  );
  assert.deepEqual(calls, [
    ["findSchedulesByClass", { classId: 7 }],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    [
      "findSchedulesByStudent",
      {
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
    ],
  ]);
});

test("AgendaApplicationService prepares a safe summary when student scope is missing", async () => {
  let calls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        calls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        calls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        calls += 1;
        return [];
      },
    },
  });

  const summary = await service.getAgendaSummaryByStudent({
    studentPersonId: "person-1",
  });

  assert.equal(summary.scopeResolved, false);
  assert.equal(summary.scheduleCount, 0);
  assert.equal(summary.noScheduleCreated, true);
  assert.equal(summary.noAttendanceCreated, true);
  assert.deepEqual(summary.schedules, []);
  assert.equal(calls, 0);
});

test("AgendaApplicationService accepts repository-provided summary and enforces no-write flags", async () => {
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment() {
        return [];
      },
      async findSchedulesByStudent() {
        return [];
      },
      async getAgendaSummaryByStudent(input) {
        return {
          scheduleCount: 1,
          schedules: [{ classId: 7 }],
          studentPersonId: input.studentPersonId,
          studentProfileId: input.studentProfileId,
        };
      },
    },
  });

  const summary = await service.getAgendaSummaryByStudent({
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  });

  assert.equal(summary.studentPersonId, "person-1");
  assert.equal(summary.studentProfileId, "profile-1");
  assert.equal(summary.readOnly, true);
  assert.equal(summary.noScheduleCreated, true);
  assert.equal(summary.noAttendanceCreated, true);
});

test("AgendaApplicationService returns a controlled blocker for invalid enrollment agenda input", async () => {
  let repositoryCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        repositoryCalls += 1;
        return [];
      },
    },
  });

  const summary = await service.getEnrollmentAgendaSummary({ enrollmentId: "" });

  assert.equal(summary.enrollmentId, null);
  assert.equal(summary.hasSchedule, false);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.noScheduleCreated, true);
  assert.equal(summary.noAttendanceCreated, true);
  assert.equal(summary.blockers[0].code, AGENDA_ENROLLMENT_ID_REQUIRED_CODE);
  assert.equal(repositoryCalls, 0);
});

test("AgendaApplicationService documents the missing EnrollmentFacade boundary", async () => {
  let repositoryCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        repositoryCalls += 1;
        return [];
      },
    },
  });

  const summary = await service.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" });

  assert.equal(summary.enrollmentId, "enr-1");
  assert.equal(summary.hasSchedule, false);
  assert.equal(summary.usesEnrollmentFacade, false);
  assert.equal(summary.blockers[0].code, AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE);
  assert.equal(repositoryCalls, 0);
});

test("AgendaApplicationService returns a prepared blocker when EnrollmentFacade has no id reader", async () => {
  let repositoryCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        repositoryCalls += 1;
        return [];
      },
    },
    enrollmentFacade: {
      async prepareEnrollmentScheduleLink() {
        throw new Error("should not be called");
      },
    },
  });

  const summary = await service.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" });

  assert.equal(summary.enrollmentId, "enr-1");
  assert.equal(summary.hasSchedule, false);
  assert.equal(summary.usesEnrollmentFacade, true);
  assert.equal(summary.blockers[0].code, AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE);
  assert.equal(repositoryCalls, 0);
});

test("AgendaApplicationService stops before AgendaRepository when enrollment is not ACTIVE", async () => {
  let repositoryCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        repositoryCalls += 1;
        return [];
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "DRAFT",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const summary = await service.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" });

  assert.equal(summary.enrollmentId, "enr-1");
  assert.equal(summary.hasSchedule, false);
  assert.equal(summary.usesEnrollmentFacade, true);
  assert.equal(summary.blockers[0].code, AGENDA_ENROLLMENT_NOT_ACTIVE_CODE);
  assert.equal(repositoryCalls, 0);
});

test("AgendaApplicationService prepares enrollment agenda summary through injected facades", async () => {
  const calls = [];
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass(input) {
        calls.push(["findSchedulesByClass", input]);
        return [];
      },
      async findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return [
          {
            classId: 7,
            enrollmentId: input.enrollmentId,
            readOnly: true,
          },
        ];
      },
      async findSchedulesByStudent(input) {
        calls.push(["findSchedulesByStudent", input]);
        return [];
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return {
          active: true,
          id: input.classId,
        };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        calls.push(["findEnrollmentById", id]);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const summary = await service.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" });

  assert.equal(summary.enrollmentId, "enr-1");
  assert.equal(summary.classId, 7);
  assert.deepEqual(summary.classIds, [7]);
  assert.equal(summary.studentPersonId, "person-1");
  assert.equal(summary.studentProfileId, "profile-1");
  assert.equal(summary.hasSchedule, true);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.noScheduleCreated, true);
  assert.equal(summary.noAttendanceCreated, true);
  assert.equal(summary.usesEnrollmentFacade, true);
  assert.equal(summary.usesClassFacade, true);
  assert.deepEqual(summary.blockers, []);
  assert.deepEqual(calls, [
    ["findEnrollmentById", "enr-1"],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    ["findActiveClassById", { classId: 7 }],
  ]);
});

test("AgendaApplicationService blocks initial agenda preparation for DRAFT enrollment", async () => {
  let repositoryCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByEnrollment() {
        repositoryCalls += 1;
        return [];
      },
      async findSchedulesByStudent() {
        repositoryCalls += 1;
        return [];
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "DRAFT",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.prepareInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });

  assert.equal(result.enrollmentId, "enr-1");
  assert.equal(result.requestedBy, "admin-1");
  assert.equal(result.canCreateAgenda, false);
  assert.equal(result.agendaCreated, false);
  assert.equal(result.noFakeAgendaCreated, true);
  assert.equal(result.noAttendanceCreated, true);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(result.blockers[0].code, AGENDA_ENROLLMENT_NOT_ACTIVE_CODE);
  assert.equal(repositoryCalls, 0);
});

test("AgendaApplicationService requires an ACTIVE Enrollment -> Turma link for initial agenda", async () => {
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment() {
        return [];
      },
      async findSchedulesByStudent() {
        return [];
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.prepareInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });
  const blockerCodes = result.blockers.map((blocker) => blocker.code);

  assert.equal(result.hasClassLink, false);
  assert.equal(result.hasTrustedClassSchedule, false);
  assert.equal(result.initialAgendaPrepared, false);
  assert.equal(result.agendaCreated, false);
  assert.equal(result.noFakeScheduleCreated, true);
  assert.match(blockerCodes.join(","), new RegExp(AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND_CODE));
  assert.match(blockerCodes.join(","), new RegExp(AGENDA_INITIAL_CLASS_LINK_REQUIRED_CODE));
});

test("AgendaApplicationService blocks initial agenda when Turma schedule fields are not trusted", async () => {
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment(input) {
        return [
          {
            classId: 7,
            enrollmentId: input.enrollmentId,
            readOnly: true,
          },
        ];
      },
      async findSchedulesByStudent() {
        return [];
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        return { active: true, id: input.classId };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.prepareInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });

  assert.equal(result.hasClassLink, true);
  assert.equal(result.hasTrustedClassSchedule, false);
  assert.equal(result.initialAgendaPrepared, false);
  assert.equal(result.agendaCreated, false);
  assert.equal(result.blockers[0].code, AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED_CODE);
});

test("AgendaApplicationService prepares initial agenda and blocks real creation by schema/idempotency gap", async () => {
  const calls = [];
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass(input) {
        calls.push(["findSchedulesByClass", input]);
        return [];
      },
      async findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return [
          {
            classId: 7,
            daysOfWeek: ["segunda", "quarta"],
            enrollmentId: input.enrollmentId,
            readOnly: true,
            startTime: "08:00",
          },
        ];
      },
      async findSchedulesByStudent(input) {
        calls.push(["findSchedulesByStudent", input]);
        return [];
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return {
          active: true,
          id: input.classId,
        };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        calls.push(["findEnrollmentById", id]);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.prepareInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });
  const blockerCodes = result.blockers.map((blocker) => blocker.code);

  assert.equal(result.initialAgendaPrepared, true);
  assert.equal(result.canCreateAgenda, false);
  assert.equal(result.creationBlocked, true);
  assert.equal(result.agendaCreated, false);
  assert.equal(result.noFakeAgendaCreated, true);
  assert.equal(result.noFakeScheduleCreated, true);
  assert.equal(result.noAttendanceCreated, true);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(result.noTestDataLeft, true);
  assert.equal(result.hasClassLink, true);
  assert.equal(result.hasTrustedClassSchedule, true);
  assert.equal(result.scheduleCandidateCount, 1);
  assert.match(blockerCodes.join(","), new RegExp(AGENDA_INITIAL_CREATION_SCHEMA_GAP_CODE));
  assert.match(blockerCodes.join(","), new RegExp(AGENDA_INITIAL_IDEMPOTENCY_GAP_CODE));
  assert.deepEqual(calls, [
    ["findEnrollmentById", "enr-1"],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    ["findActiveClassById", { classId: 7 }],
  ]);
});

test("AgendaApplicationService enables initial agenda creation when persistence repository is available", async () => {
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment(input) {
        return [
          {
            classId: 7,
            classLinkId: "link-1",
            daysOfWeek: ["segunda"],
            enrollmentId: input.enrollmentId,
            readOnly: true,
            startTime: "08:00",
          },
        ];
      },
      async findSchedulesByStudent() {
        return [];
      },
      async createInitialAgendaForEnrollment() {
        throw new Error("prepare must not persist");
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        return { active: true, id: input.classId };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.prepareInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });

  assert.equal(result.initialAgendaPrepared, true);
  assert.equal(result.canCreateAgenda, true);
  assert.equal(result.creationBlocked, false);
  assert.equal(result.agendaCreated, false);
  assert.deepEqual(result.blockers, []);
});

test("AgendaApplicationService creates initial agenda through repository without side effects", async () => {
  const calls = [];
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass(input) {
        calls.push(["findSchedulesByClass", input]);
        return [];
      },
      async findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return [
          {
            classId: 7,
            classLinkId: "link-1",
            daysOfWeek: ["segunda", "quarta"],
            enrollmentId: input.enrollmentId,
            readOnly: true,
            startTime: "08:00",
          },
        ];
      },
      async findSchedulesByStudent(input) {
        calls.push(["findSchedulesByStudent", input]);
        return [];
      },
      async createInitialAgendaForEnrollment(input) {
        calls.push(["createInitialAgendaForEnrollment", input]);
        return {
          agendaItems: [
            {
              classId: input.classId,
              dayOfWeek: "segunda",
              enrollmentId: input.enrollmentId,
              persistedAgenda: true,
              startTime: "08:00",
            },
            {
              classId: input.classId,
              dayOfWeek: "quarta",
              enrollmentId: input.enrollmentId,
              persistedAgenda: true,
              startTime: "08:00",
            },
          ],
          createdCount: 2,
          reusedCount: 0,
        };
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return { active: true, id: input.classId };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        calls.push(["findEnrollmentById", id]);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.createInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });

  assert.equal(result.initialAgendaPrepared, true);
  assert.equal(result.canCreateAgenda, true);
  assert.equal(result.creationBlocked, false);
  assert.equal(result.agendaCreated, true);
  assert.equal(result.createdCount, 2);
  assert.equal(result.reusedCount, 0);
  assert.equal(result.persistedAgendaCount, 2);
  assert.equal(result.duplicateAgendaReusedOrBlocked, true);
  assert.equal(result.noAttendanceCreated, true);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(calls, [
    ["findEnrollmentById", "enr-1"],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    ["findActiveClassById", { classId: 7 }],
    [
      "createInitialAgendaForEnrollment",
      {
        classId: 7,
        enrollmentId: "enr-1",
        requestedBy: "admin-1",
        scheduleCandidates: [
          {
            classId: 7,
            classLinkId: "link-1",
            daysOfWeek: ["segunda", "quarta"],
            enrollmentId: "enr-1",
            readOnly: true,
            startTime: "08:00",
          },
        ],
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
    ],
  ]);
});

test("AgendaApplicationService keeps notifications disabled when recipients are not explicit", async () => {
  let notificationCalls = 0;
  const service = new AgendaApplicationService({
    agendaRepository: createRescheduleRepository(),
    notificationService: {
      async enqueueAgendaNotification() {
        notificationCalls += 1;
        throw new Error("notification must not be called");
      },
    },
  });

  const result = await service.rescheduleAgendaEvent({
    agendaItemId: "agenda-1",
    classId: 7,
    dayOfWeek: 1,
    requestedBy: "admin-1",
    toDate: "2026-07-13",
    toEndTime: "09:00",
    toStartTime: "08:00",
  });

  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(result.notificationSideEffects, undefined);
  assert.equal(notificationCalls, 0);
});

test("AgendaApplicationService enqueues notifications only for explicit recipients", async () => {
  const notificationPayloads = [];
  const service = new AgendaApplicationService({
    agendaRepository: createRescheduleRepository(),
    notificationService: {
      async enqueueAgendaNotification(payload) {
        notificationPayloads.push(payload);
        return { queuedCount: 1 };
      },
    },
  });

  const result = await service.rescheduleAgendaEvent({
    agendaItemId: "agenda-1",
    classId: 7,
    notificationChannels: ["IN_APP"],
    notificationRecipients: [{ id: "student-1", type: "STUDENT" }],
    requestedBy: "admin-1",
    toDate: "2026-07-13",
    toEndTime: "09:00",
    toStartTime: "08:00",
  });

  assert.equal(result.noNotificationSideEffects, false);
  assert.equal(result.notificationSideEffects, true);
  assert.equal(result.agendaNotification.queuedCount, 1);
  assert.equal(notificationPayloads.length, 1);
  assert.equal(notificationPayloads[0].agendaItemId, "agenda-1");
  assert.deepEqual(notificationPayloads[0].recipients, [{ id: "student-1", type: "STUDENT" }]);
});

test("AgendaApplicationService reuses duplicate initial agenda through repository", async () => {
  const service = new AgendaApplicationService({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment(input) {
        return [
          {
            classId: 7,
            daysOfWeek: ["segunda"],
            enrollmentId: input.enrollmentId,
            readOnly: true,
            startTime: "08:00",
          },
        ];
      },
      async findSchedulesByStudent() {
        return [];
      },
      async createInitialAgendaForEnrollment(input) {
        return {
          agendaItems: [
            {
              classId: input.classId,
              dayOfWeek: "segunda",
              enrollmentId: input.enrollmentId,
              persistedAgenda: true,
              startTime: "08:00",
            },
          ],
          createdCount: 0,
          reusedCount: 1,
        };
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        return { active: true, id: input.classId };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const result = await service.createInitialAgendaForEnrollment({
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
  });

  assert.equal(result.agendaCreated, false);
  assert.equal(result.agendaReused, true);
  assert.equal(result.createdCount, 0);
  assert.equal(result.reusedCount, 1);
  assert.equal(result.duplicateAgendaReusedOrBlocked, true);
  assert.equal(result.noAttendanceCreated, true);
});

function createRescheduleRepository() {
  return {
    async findAgendaAdministrativeBlocks() {
      return [];
    },
    async findAgendaConflictCandidates() {
      return [];
    },
    async findSchedulesByClass() {
      return [];
    },
    async findSchedulesByEnrollment() {
      return [];
    },
    async findSchedulesByStudent() {
      return [];
    },
    async updateAgendaItemSchedule(input) {
      return {
        agendaItemId: input.agendaItemId,
        classId: 7,
        dayOfWeek: input.dayOfWeek,
        endTime: input.endTime,
        startTime: input.startTime,
      };
    },
  };
}
