const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE,
  AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE,
  AgendaNotificationChannel,
  AgendaNotificationEventType,
  AgendaNotificationRecipientType,
  prepareAgendaNotificationEvent,
} = require("../contracts/agenda-notification.contract.js");

test("prepareAgendaNotificationEvent normalizes Agenda notification payloads", () => {
  const event = prepareAgendaNotificationEvent({
    actorId: "admin@j12.com",
    agendaItemId: "agenda_1",
    channels: ["in_app", "whatsapp", "email", "push"],
    eventType: AgendaNotificationEventType.AGENDA_EVENT_RESCHEDULED,
    recipients: [
      {
        id: "42",
        type: "student",
      },
    ],
  });

  assert.equal(event.agendaItemId, "agenda_1");
  assert.deepEqual(event.channels, [
    AgendaNotificationChannel.IN_APP,
    AgendaNotificationChannel.WHATSAPP,
    AgendaNotificationChannel.EMAIL,
    AgendaNotificationChannel.PUSH,
  ]);
  assert.equal(event.eventType, AgendaNotificationEventType.AGENDA_EVENT_RESCHEDULED);
  assert.equal(event.recipients[0].recipientId, "42");
  assert.equal(event.recipients[0].recipientType, AgendaNotificationRecipientType.STUDENT);
  assert.equal(event.safePayload, true);
});

test("prepareAgendaNotificationEvent rejects unsupported event types", () => {
  assert.throws(
    () =>
      prepareAgendaNotificationEvent({
        actorId: "admin",
        agendaItemId: "agenda_1",
        eventType: "UNKNOWN",
        recipients: [{ id: "1", type: "student" }],
      }),
    (error) => error?.code === AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE,
  );
});

test("prepareAgendaNotificationEvent requires at least one recipient", () => {
  assert.throws(
    () =>
      prepareAgendaNotificationEvent({
        actorId: "admin",
        agendaItemId: "agenda_1",
        eventType: AgendaNotificationEventType.AGENDA_EVENT_CREATED,
      }),
    (error) => error?.code === AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE,
  );
});
