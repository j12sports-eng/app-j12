const AGENDA_NOTIFICATION_INPUT_REQUIRED_CODE = "AGENDA_NOTIFICATION_INPUT_REQUIRED";
const AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE = "AGENDA_NOTIFICATION_EVENT_TYPE_INVALID";
const AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE = "AGENDA_NOTIFICATION_RECIPIENT_REQUIRED";

const AgendaNotificationEventType = Object.freeze({
  AGENDA_EVENT_CANCELLED: "AGENDA_EVENT_CANCELLED",
  AGENDA_EVENT_CREATED: "AGENDA_EVENT_CREATED",
  AGENDA_EVENT_REMINDER: "AGENDA_EVENT_REMINDER",
  AGENDA_EVENT_RESCHEDULED: "AGENDA_EVENT_RESCHEDULED",
  AGENDA_EVENT_UPDATED: "AGENDA_EVENT_UPDATED",
  AGENDA_PROFESSOR_CHANGED: "AGENDA_PROFESSOR_CHANGED",
  AGENDA_RECURRENCE_CHANGED: "AGENDA_RECURRENCE_CHANGED",
  AGENDA_COURT_CHANGED: "AGENDA_COURT_CHANGED",
});

const AgendaNotificationRecipientType = Object.freeze({
  ADMIN: "ADMIN",
  PROFESSOR: "PROFESSOR",
  RESPONSIBLE: "RESPONSIBLE",
  STUDENT: "STUDENT",
});

const AgendaNotificationChannel = Object.freeze({
  EMAIL: "EMAIL",
  IN_APP: "IN_APP",
  PUSH: "PUSH",
  WHATSAPP: "WHATSAPP",
});

const AgendaNotificationDeliveryStatus = Object.freeze({
  FAILED: "FAILED",
  PENDING: "PENDING",
  PREPARED: "PREPARED",
  READ: "READ",
  RETRY: "RETRY",
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  UNREAD: "UNREAD",
});

const AGENDA_NOTIFICATION_EVENT_TYPES = Object.freeze(Object.values(AgendaNotificationEventType));
const AGENDA_NOTIFICATION_CHANNELS = Object.freeze(Object.values(AgendaNotificationChannel));
const AGENDA_NOTIFICATION_RECIPIENT_TYPES = Object.freeze(
  Object.values(AgendaNotificationRecipientType),
);

const EVENT_TYPE_LABELS = Object.freeze({
  [AgendaNotificationEventType.AGENDA_EVENT_CANCELLED]: "Evento cancelado",
  [AgendaNotificationEventType.AGENDA_EVENT_CREATED]: "Novo evento na agenda",
  [AgendaNotificationEventType.AGENDA_EVENT_REMINDER]: "Lembrete da agenda",
  [AgendaNotificationEventType.AGENDA_EVENT_RESCHEDULED]: "Evento reagendado",
  [AgendaNotificationEventType.AGENDA_EVENT_UPDATED]: "Evento alterado",
  [AgendaNotificationEventType.AGENDA_PROFESSOR_CHANGED]: "Professor alterado",
  [AgendaNotificationEventType.AGENDA_RECURRENCE_CHANGED]: "Recorrencia alterada",
  [AgendaNotificationEventType.AGENDA_COURT_CHANGED]: "Quadra alterada",
});

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function prepareAgendaNotificationEvent(input = {}) {
  const eventType = normalizeEventType(input.eventType || input.type);
  const occurredAt = nullableText(input.occurredAt, 40) || new Date().toISOString();
  const actorId = nullableText(input.actorId || input.requestedBy || input.createdBy, 191);
  const agendaItemId = nullableText(input.agendaItemId || input.eventId || input.scheduleId, 64);
  const recurrenceSeriesId = nullableText(input.recurrenceSeriesId || input.seriesId, 64);

  if (!eventType || !actorId || (!agendaItemId && !recurrenceSeriesId)) {
    throw controlledError(
      "prepareAgendaNotificationEvent requires eventType, actorId and agendaItemId or recurrenceSeriesId.",
      AGENDA_NOTIFICATION_INPUT_REQUIRED_CODE,
      {
        hasActorId: Boolean(actorId),
        hasAgendaItemId: Boolean(agendaItemId),
        hasEventType: Boolean(eventType),
        hasRecurrenceSeriesId: Boolean(recurrenceSeriesId),
      },
    );
  }

  if (!AGENDA_NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    throw controlledError(
      "Unsupported Agenda notification eventType.",
      AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE,
      {
        allowedEventTypes: [...AGENDA_NOTIFICATION_EVENT_TYPES],
        eventType,
      },
    );
  }

  const recipients = normalizeRecipients(input.recipients);

  if (recipients.length === 0) {
    throw controlledError(
      "Agenda notification requires at least one recipient.",
      AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE,
    );
  }

  const safeMetadata = normalizeMetadata(input.metadata);
  const title = nullableText(input.title, 160) || EVENT_TYPE_LABELS[eventType];
  const message =
    nullableText(input.message, 500) ||
    buildDefaultMessage({
      className: input.className,
      date: input.date || input.scheduleDate,
      eventType,
      startTime: input.startTime,
    });

  return {
    actorId,
    agendaItemId,
    channels: normalizeChannels(input.channels),
    classId: nullableText(input.classId, 64),
    contractVersion: "sprint-13.13",
    eventType,
    idempotencyKey:
      nullableText(input.idempotencyKey, 191) ||
      buildAgendaNotificationIdempotencyKey({
        agendaItemId,
        eventType,
        occurrenceKey: input.occurrenceKey,
        recurrenceSeriesId,
      }),
    message,
    metadata: safeMetadata,
    notificationType: normalizeNotificationType(input.notificationType || eventType),
    occurredAt,
    occurrenceKey: nullableText(input.occurrenceKey, 191),
    prepared: true,
    recipients,
    recurrenceSeriesId,
    safePayload: true,
    title,
  };
}

function normalizeRecipients(value) {
  return normalizeObjectArray(value)
    .map((recipient) => {
      const recipientType = normalizeRecipientType(recipient.recipientType || recipient.type);
      const recipientId = nullableText(
        recipient.recipientId || recipient.id || recipient.userId || recipient.user_id,
        191,
      );

      if (!recipientType || !recipientId) {
        return null;
      }

      return {
        email: nullableText(recipient.email, 191),
        name: nullableText(recipient.name || recipient.nome, 191),
        phoneWhatsapp: nullableText(recipient.phoneWhatsapp || recipient.whatsapp, 64),
        recipientId,
        recipientType,
      };
    })
    .filter(Boolean);
}

function normalizeChannels(value) {
  const raw = Array.isArray(value) && value.length > 0 ? value : [AgendaNotificationChannel.IN_APP];
  const normalized = raw
    .map((channel) => normalizeUpperText(channel))
    .filter((channel) => AGENDA_NOTIFICATION_CHANNELS.includes(channel));

  return Array.from(new Set(normalized.length > 0 ? normalized : [AgendaNotificationChannel.IN_APP]));
}

function normalizeEventType(value) {
  const normalized = normalizeUpperText(value);
  return AGENDA_NOTIFICATION_EVENT_TYPES.includes(normalized) ? normalized : normalized;
}

function normalizeRecipientType(value) {
  const normalized = normalizeUpperText(value);
  return AGENDA_NOTIFICATION_RECIPIENT_TYPES.includes(normalized) ? normalized : null;
}

function normalizeNotificationType(value) {
  return normalizeUpperText(value) || "AGENDA";
}

function normalizeMetadata(value) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};

  for (const [key, item] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey) continue;

    if (item === null || ["boolean", "number", "string"].includes(typeof item)) {
      normalized[normalizedKey] = typeof item === "string" ? nullableText(item, 191) : item;
    }
  }

  return normalized;
}

function buildDefaultMessage({ className, date, eventType, startTime }) {
  const subject = nullableText(className, 120) || "Agenda J12";
  const when = [nullableText(date, 20), nullableText(startTime, 20)].filter(Boolean).join(" ");

  if (eventType === AgendaNotificationEventType.AGENDA_EVENT_REMINDER) {
    return when ? `${subject}: lembrete para ${when}.` : `${subject}: lembrete da agenda.`;
  }

  return when ? `${EVENT_TYPE_LABELS[eventType]} em ${subject} (${when}).` : `${EVENT_TYPE_LABELS[eventType]} em ${subject}.`;
}

function buildAgendaNotificationIdempotencyKey({
  agendaItemId = null,
  eventType,
  occurrenceKey = null,
  recurrenceSeriesId = null,
}) {
  return [
    "agenda-notification",
    eventType,
    agendaItemId || "",
    recurrenceSeriesId || "",
    occurrenceKey || "",
  ].join(":");
}

function normalizeObjectArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function normalizeUpperText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  AGENDA_NOTIFICATION_CHANNELS,
  AGENDA_NOTIFICATION_EVENT_TYPES,
  AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE,
  AGENDA_NOTIFICATION_INPUT_REQUIRED_CODE,
  AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE,
  AGENDA_NOTIFICATION_RECIPIENT_TYPES,
  AgendaNotificationChannel,
  AgendaNotificationDeliveryStatus,
  AgendaNotificationEventType,
  AgendaNotificationRecipientType,
  buildAgendaNotificationIdempotencyKey,
  prepareAgendaNotificationEvent,
};
