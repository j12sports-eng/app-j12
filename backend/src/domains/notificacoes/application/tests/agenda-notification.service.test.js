const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AgendaNotificationChannel,
  AgendaNotificationDeliveryStatus,
  AgendaNotificationEventType,
} = require("../contracts/agenda-notification.contract.js");
const {
  AGENDA_NOTIFICATION_NOT_FOUND_CODE,
  AgendaNotificationService,
  evaluateNotificationPreference,
} = require("../services/agenda-notification.service.js");

test("AgendaNotificationService enqueues recipients and respects muted preferences", async () => {
  const repository = createFakeRepository({
    preferences: new Map([
      ["STUDENT:1:WHATSAPP:AGENDA_EVENT_CREATED", { enabled: false }],
    ]),
  });
  const service = new AgendaNotificationService({
    clock: () => new Date("2026-07-03T12:00:00.000Z"),
    notificationRepository: repository,
  });

  const result = await service.enqueueAgendaNotification({
    actorId: "admin@j12.com",
    agendaItemId: "agenda_1",
    channels: [AgendaNotificationChannel.IN_APP, AgendaNotificationChannel.WHATSAPP],
    eventType: AgendaNotificationEventType.AGENDA_EVENT_CREATED,
    recipients: [{ id: "1", type: "student" }],
  });

  assert.equal(result.queuedCount, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(repository.jobs[0].channel, AgendaNotificationChannel.IN_APP);
  assert.equal(repository.auditLogs[0].action, "SKIP_BY_PREFERENCE");
});

test("AgendaNotificationService processes in-app jobs asynchronously", async () => {
  const repository = createFakeRepository({
    pendingJobs: [
      {
        channel: AgendaNotificationChannel.IN_APP,
        eventId: "evt_1",
        id: "job_1",
        message: "Mensagem",
        notificationType: AgendaNotificationEventType.AGENDA_EVENT_REMINDER,
        recipientId: "1",
        recipientType: "STUDENT",
        title: "Lembrete",
      },
    ],
  });
  const service = new AgendaNotificationService({ notificationRepository: repository });

  const result = await service.processQueue({ limit: 5 });

  assert.equal(result.processedCount, 1);
  assert.equal(repository.notifications.length, 1);
  assert.equal(repository.completedJobs[0].status, AgendaNotificationDeliveryStatus.SENT);
});

test("AgendaNotificationService marks external channels as prepared without adapters", async () => {
  const service = new AgendaNotificationService({ notificationRepository: createFakeRepository() });
  const delivery = await service.dispatchJob({
    channel: AgendaNotificationChannel.EMAIL,
    id: "job_1",
  });

  assert.equal(delivery.status, AgendaNotificationDeliveryStatus.PREPARED);
  assert.equal(delivery.externalAdapterPrepared, true);
});

test("AgendaNotificationService reports not found when marking unknown notifications", async () => {
  const service = new AgendaNotificationService({
    notificationRepository: {
      markNotificationRead: async () => null,
    },
  });

  await assert.rejects(
    () => service.markAsRead({ notificationId: "missing" }),
    (error) => error?.code === AGENDA_NOTIFICATION_NOT_FOUND_CODE,
  );
});

test("evaluateNotificationPreference blocks outside allowed hours", () => {
  const decision = evaluateNotificationPreference(
    {
      allowedEnd: "18:00",
      allowedStart: "09:00",
      enabled: true,
    },
    {
      channel: AgendaNotificationChannel.IN_APP,
      clock: () => new Date("2026-07-03T22:00:00.000Z"),
      notificationType: AgendaNotificationEventType.AGENDA_EVENT_CREATED,
    },
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "OUTSIDE_ALLOWED_HOURS");
});

function createFakeRepository({ pendingJobs = [], preferences = new Map() } = {}) {
  return {
    auditLogs: [],
    completedJobs: [],
    events: [],
    jobs: [],
    notifications: [],
    async completeNotificationJob(input) {
      this.completedJobs.push(input);
      return { id: input.jobId, status: input.status };
    },
    async createAgendaNotificationEvent(event) {
      const persisted = { ...event, id: "evt_1" };
      this.events.push(persisted);
      return persisted;
    },
    async createNotificationRecord(input) {
      const notification = { ...input, id: `ntf_${this.notifications.length + 1}` };
      this.notifications.push(notification);
      return notification;
    },
    async enqueueNotificationJob(input) {
      const job = { ...input, id: `job_${this.jobs.length + 1}` };
      this.jobs.push(job);
      return job;
    },
    async failNotificationJob(input) {
      return { ...input.job, status: AgendaNotificationDeliveryStatus.RETRY };
    },
    async findNotificationPreference(input) {
      return preferences.get(
        `${input.recipientType}:${input.recipientId}:${input.channel}:${input.notificationType}`,
      ) || null;
    },
    async listPendingNotificationJobs() {
      return pendingJobs;
    },
    async recordNotificationAudit(input) {
      this.auditLogs.push(input);
      return { auditLogged: true };
    },
  };
}
