const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS_CODE,
  EnrollmentNotificationEventType,
} = require("../contracts/index.js");
const {
  ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH_CODE,
  EnrollmentNotificationService,
} = require("../services/enrollment-notification.service.js");

test("EnrollmentNotificationService prepares a no-send notification for confirmed Enrollment", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-notification-1",
    status: "ACTIVE",
    studentPersonId: "person-notification-1",
    studentProfileId: "profile-notification-1",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentNotification({
    enrollmentId: "active-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    requestedBy: "admin@j12.local",
  });
  const repeated = await service.prepareEnrollmentNotification({
    enrollmentId: "active-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.eventType, EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED);
  assert.equal(result.studentPersonId, "person-notification-1");
  assert.equal(result.studentProfileId, "profile-notification-1");
  assert.equal(result.notificationCreated, false);
  assert.equal(result.emailSent, false);
  assert.equal(result.whatsappSent, false);
  assert.equal(result.pushSent, false);
  assert.equal(result.notificationDispatcherCalled, false);
  assert.equal(result.socketEventEmitted, false);
  assert.equal(result.safePayload, true);
  assert.deepEqual(result.minimalPayload, {
    enrollmentId: "active-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
    studentPersonId: "person-notification-1",
    studentProfileId: "profile-notification-1",
  });
  assert.equal(result.notificationCreationBlockedBySchemaOrModuleGap, true);
  assert.equal(result.idempotency.safeToRetry, true);
  assert.equal(repeated.idempotency.key, result.idempotency.key);
  assert.deepEqual(reader.calls, ["active-notification-1", "active-notification-1"]);
});

test("EnrollmentNotificationService prepares a no-send notification for DRAFT creation", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-notification-1",
    status: "DRAFT",
    studentPersonId: "person-notification-2",
    studentProfileId: "profile-notification-2",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentNotification({
    enrollmentId: "draft-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_DRAFT_CREATED,
    requestedBy: "system",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentStatus, "DRAFT");
  assert.equal(result.notificationCreated, false);
});

test("EnrollmentNotificationService prepares notification contract from a safe internal event payload", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "event-notification-1",
    status: "ACTIVE",
    studentPersonId: "person-notification-event",
    studentProfileId: "profile-notification-event",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentNotificationFromEvent({
    enrollmentId: "event-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CLASS_LINKED,
    occurredAt: "2026-07-01T12:00:00.000Z",
    payload: {
      cpf: "123.456.789-00",
      stack: "sensitive stack",
      token: "secret-token",
    },
    requestedBy: "admin@j12.local",
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.notificationPreparedFromEvent, true);
  assert.equal(result.notificationModuleMapped, true);
  assert.equal(result.notificationCreationBlockedBySchemaOrInfraGap, true);
  assert.equal(result.notificationContractDocumented, true);
  assert.equal(result.safePayload, true);
  assert.equal(result.noEmailSent, true);
  assert.equal(result.noWhatsappSent, true);
  assert.equal(result.noPushSent, true);
  assert.equal(result.unsafePayloadDropped, true);
  assert.deepEqual(result.minimalPayload, {
    enrollmentId: "event-notification-1",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_CLASS_LINKED,
    occurredAt: "2026-07-01T12:00:00.000Z",
    studentPersonId: "person-notification-event",
    studentProfileId: "profile-notification-event",
  });
  assert.equal(serialized.includes("123.456.789-00"), false);
  assert.equal(serialized.includes("secret-token"), false);
  assert.equal(serialized.includes("sensitive stack"), false);
});

test("EnrollmentNotificationService supports financial obligation notification event as prepared-only", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "financial-obligation-notification",
    status: "ACTIVE",
    studentPersonId: "person-notification-financial",
    studentProfileId: "profile-notification-financial",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentNotificationFromEvent({
    enrollmentId: "financial-obligation-notification",
    eventType: EnrollmentNotificationEventType.ENROLLMENT_FINANCIAL_OBLIGATION_CREATED,
    occurredAt: "2026-07-01T12:30:00.000Z",
    requestedBy: "system",
  });

  assert.equal(
    result.eventType,
    EnrollmentNotificationEventType.ENROLLMENT_FINANCIAL_OBLIGATION_CREATED,
  );
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.notificationCreated, false);
  assert.equal(result.noEmailSent, true);
  assert.equal(result.noWhatsappSent, true);
  assert.equal(result.noPushSent, true);
});

test("EnrollmentNotificationService blocks event incompatible with current Enrollment status", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-notification-2",
    status: "DRAFT",
    studentPersonId: "person-notification-3",
    studentProfileId: "profile-notification-3",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentNotification({
        enrollmentId: "draft-notification-2",
        eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_NOTIFICATION_INVALID_ENROLLMENT_STATUS_CODE },
  );
});

test("EnrollmentNotificationService handles missing Enrollment as a controlled error", async () => {
  const service = new EnrollmentNotificationService({
    enrollmentReader: new FakeEnrollmentReader(),
  });

  await assert.rejects(
    () =>
      service.prepareEnrollmentNotification({
        enrollmentId: "missing-notification-1",
        eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND_CODE },
  );
});

test("EnrollmentNotificationService rejects mismatched student identifiers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-notification-2",
    status: "ACTIVE",
    studentPersonId: "person-notification-4",
    studentProfileId: "profile-notification-4",
  });
  const service = new EnrollmentNotificationService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentNotification({
        enrollmentId: "active-notification-2",
        eventType: EnrollmentNotificationEventType.ENROLLMENT_CONFIRMED,
        requestedBy: "admin@j12.local",
        studentPersonId: "wrong-person",
        studentProfileId: "profile-notification-4",
      }),
    { code: ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH_CODE },
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
