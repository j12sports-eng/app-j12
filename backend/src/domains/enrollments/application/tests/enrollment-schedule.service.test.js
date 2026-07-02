const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH_CODE,
  EnrollmentScheduleService,
} = require("../services/enrollment-schedule.service.js");

test("EnrollmentScheduleService prepares a no-write schedule link for ACTIVE Enrollment", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-schedule-1",
    status: "ACTIVE",
    studentPersonId: "person-schedule-1",
    studentProfileId: "profile-schedule-1",
  });
  const service = new EnrollmentScheduleService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentScheduleLink({
    classId: 15,
    classSchedule: {
      diasSemana: ["segunda", "quarta"],
      horarioFim: "19:00",
      horarioInicio: "18:00",
    },
    enrollmentId: "active-schedule-1",
    requestedBy: "admin@j12.local",
  });
  const repeated = await service.prepareEnrollmentScheduleLink({
    classId: 15,
    enrollmentId: "active-schedule-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.studentPersonId, "person-schedule-1");
  assert.equal(result.studentProfileId, "profile-schedule-1");
  assert.equal(result.classId, "15");
  assert.deepEqual(result.classSchedule.daysOfWeek, ["segunda", "quarta"]);
  assert.equal(result.scheduleCreated, false);
  assert.equal(result.financialSideEffects, false);
  assert.equal(result.notificationSideEffects, false);
  assert.equal(result.scheduleGatewayCalled, false);
  assert.equal(result.scheduleCreationBlockedBySchemaOrModuleGap, true);
  assert.equal(result.idempotency.safeToRetry, true);
  assert.equal(repeated.idempotency.key, result.idempotency.key);
  assert.deepEqual(reader.calls, ["active-schedule-1", "active-schedule-1"]);
});

test("EnrollmentScheduleService prepares initial schedule only for ACTIVE linked Enrollment", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-linked-schedule",
    status: "ACTIVE",
    studentPersonId: "person-schedule-linked",
    studentProfileId: "profile-schedule-linked",
  });
  const service = new EnrollmentScheduleService({
    classLinkReader: {
      async findActiveByEnrollmentAndClass(input) {
        return {
          classId: input.classId,
          enrollmentId: input.enrollmentId,
          id: "class-link-1",
          status: "ACTIVE",
        };
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          dias_semana_json: "[\"segunda\",\"quarta\"]",
          horario_fim: "19:00",
          horario_inicio: "18:00",
          id,
          status: "ativa",
        };
      },
    },
    enrollmentReader: reader,
  });

  const result = await service.createInitialScheduleForEnrollment({
    classId: 31,
    enrollmentId: "active-linked-schedule",
    requestedBy: "admin@j12.local",
  });
  const repeated = await service.createInitialScheduleForEnrollment({
    classId: 31,
    enrollmentId: "active-linked-schedule",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.enrollmentSchedulePrepared, true);
  assert.equal(result.activeClassLinkFound, true);
  assert.equal(result.activeClassLinkId, "class-link-1");
  assert.equal(result.classScheduleMapped, true);
  assert.equal(result.scheduleCreated, false);
  assert.equal(result.noFakeScheduleCreated, true);
  assert.equal(result.noScheduleCreated, true);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(result.scheduleCreationBlockedBySchemaOrRuleGap, true);
  assert.equal(result.scheduleCreationIsIdempotent, true);
  assert.equal(result.idempotency.safeToRetry, true);
  assert.equal(repeated.idempotency.key, result.idempotency.key);
});

test("EnrollmentScheduleService blocks DRAFT Enrollment before schedule preparation", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-schedule-1",
    status: "DRAFT",
    studentPersonId: "person-schedule-2",
    studentProfileId: "profile-schedule-2",
  });
  const service = new EnrollmentScheduleService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentScheduleLink({
        classId: 15,
        enrollmentId: "draft-schedule-1",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE },
  );
});

test("EnrollmentScheduleService blocks DRAFT Enrollment before initial schedule preparation", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-initial-schedule",
    status: "DRAFT",
    studentPersonId: "person-schedule-draft",
    studentProfileId: "profile-schedule-draft",
  });
  const service = new EnrollmentScheduleService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.createInitialScheduleForEnrollment({
        classId: 31,
        enrollmentId: "draft-initial-schedule",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE },
  );
});

test("EnrollmentScheduleService handles missing Enrollment as a controlled error", async () => {
  const service = new EnrollmentScheduleService({
    enrollmentReader: new FakeEnrollmentReader(),
  });

  await assert.rejects(
    () =>
      service.prepareEnrollmentScheduleLink({
        classId: 15,
        enrollmentId: "missing-schedule-1",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE },
  );
});

test("EnrollmentScheduleService blocks initial schedule without active class link", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "unlinked-schedule",
    status: "ACTIVE",
    studentPersonId: "person-schedule-unlinked",
    studentProfileId: "profile-schedule-unlinked",
  });
  const service = new EnrollmentScheduleService({
    classLinkReader: {
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    enrollmentReader: reader,
  });

  await assert.rejects(
    () =>
      service.createInitialScheduleForEnrollment({
        classId: 31,
        enrollmentId: "unlinked-schedule",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING_CODE },
  );
});

test("EnrollmentScheduleService handles missing class schedule before initial schedule", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "missing-class-schedule",
    status: "ACTIVE",
    studentPersonId: "person-schedule-missing",
    studentProfileId: "profile-schedule-missing",
  });
  const service = new EnrollmentScheduleService({
    classLinkReader: {
      async findActiveByEnrollmentAndClass(input) {
        return {
          classId: input.classId,
          enrollmentId: input.enrollmentId,
          id: "class-link-missing-schedule",
          status: "ACTIVE",
        };
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          id,
          status: "ativa",
        };
      },
    },
    enrollmentReader: reader,
  });

  await assert.rejects(
    () =>
      service.createInitialScheduleForEnrollment({
        classId: 31,
        enrollmentId: "missing-class-schedule",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING_CODE },
  );
});

test("EnrollmentScheduleService rejects mismatched student identifiers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-schedule-2",
    status: "ACTIVE",
    studentPersonId: "person-schedule-3",
    studentProfileId: "profile-schedule-3",
  });
  const service = new EnrollmentScheduleService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentScheduleLink({
        classId: 15,
        enrollmentId: "active-schedule-2",
        requestedBy: "admin@j12.local",
        studentPersonId: "wrong-person",
        studentProfileId: "profile-schedule-3",
      }),
    { code: ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH_CODE },
  );
});

class FakeEnrollmentReader {
  constructor() {
    this.calls = [];
    this.records = new Map();
  }

  seed(record) {
    this.records.set(record.id, { ...record });
  }

  async findEnrollmentById(id) {
    this.calls.push(id);
    return this.records.get(id) || null;
  }
}
