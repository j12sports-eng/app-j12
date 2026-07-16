const {
  AgendaNotificationChannel,
  AgendaNotificationDeliveryStatus,
  prepareAgendaNotificationEvent,
} = require("../contracts/agenda-notification.contract.js");
const { observeAsyncOperation } = require("../../../../observability/async-observability.js");

const AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE = "AGENDA_NOTIFICATION_REPOSITORY_REQUIRED";
const AGENDA_NOTIFICATION_NOT_FOUND_CODE = "AGENDA_NOTIFICATION_NOT_FOUND";

class AgendaNotificationService {
  /**
   * @param {Object} [options]
   * @param {Record<string, Function>|null} [options.notificationRepository]
   * @param {Record<string, Function>|null} [options.repository]
   * @param {Record<string, Function>} [options.adapters]
   * @param {() => Date} [options.clock]
   */
  constructor({
    adapters = {},
    clock = () => new Date(),
    notificationRepository = null,
    repository = null,
  } = {}) {
    this.notificationRepository = notificationRepository || repository;
    this.adapters = adapters;
    this.clock = clock;
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async enqueueAgendaNotification(input = {}) {
    const repository = this.getRepository([
      "createAgendaNotificationEvent",
      "enqueueNotificationJob",
      "findNotificationPreference",
      "recordNotificationAudit",
    ]);
    const event = prepareAgendaNotificationEvent(input);
    const persistedEvent = await repository.createAgendaNotificationEvent(event);
    const queuedJobs = [];
    const skipped = [];

    for (const recipient of event.recipients) {
      for (const channel of event.channels) {
        const preference = await repository.findNotificationPreference({
          channel,
          notificationType: event.notificationType,
          recipientId: recipient.recipientId,
          recipientType: recipient.recipientType,
        });
        const decision = evaluateNotificationPreference(preference, {
          channel,
          clock: this.clock,
          notificationType: event.notificationType,
        });

        if (!decision.allowed) {
          skipped.push({ channel, decision, recipient });
          await repository.recordNotificationAudit({
            action: "SKIP_BY_PREFERENCE",
            details: decision,
            eventId: persistedEvent.id,
            recipientId: recipient.recipientId,
            recipientType: recipient.recipientType,
            status: AgendaNotificationDeliveryStatus.SKIPPED,
          });
          continue;
        }

        queuedJobs.push(
          await repository.enqueueNotificationJob({
            channel,
            event: persistedEvent,
            eventType: event.eventType,
            idempotencyKey: [
              event.idempotencyKey,
              recipient.recipientType,
              recipient.recipientId,
              channel,
            ].join(":"),
            message: event.message,
            notificationType: event.notificationType,
            recipient,
            scheduledAt: decision.scheduledAt || event.occurredAt,
            title: event.title,
          }),
        );
      }
    }

    return {
      agendaNotificationQueued: queuedJobs.length > 0,
      channelsPrepared: true,
      emailPrepared: event.channels.includes(AgendaNotificationChannel.EMAIL),
      event: persistedEvent,
      noExternalMessageSentSynchronously: true,
      pushPrepared: event.channels.includes(AgendaNotificationChannel.PUSH),
      queuedCount: queuedJobs.length,
      queuedJobs,
      skipped,
      whatsappPrepared: event.channels.includes(AgendaNotificationChannel.WHATSAPP),
    };
  }

  /**
   * @param {{ limit?: number }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async processQueue(input = {}) {
    const repository = this.getRepository([
      "completeNotificationJob",
      "createNotificationRecord",
      "failNotificationJob",
      "listPendingNotificationJobs",
      "recordNotificationAudit",
    ]);
    const jobs = await repository.listPendingNotificationJobs({
      limit: normalizeLimit(input.limit, 50),
      now: this.clock().toISOString(),
    });
    const processed = [];

    for (const job of Array.isArray(jobs) ? jobs : []) {
      try {
        const delivery = await observeAsyncOperation(
          "agenda.notification.dispatch",
          () => this.dispatchJob(job),
          { channel: job.channel || null, jobId: job.id || null },
        );
        const completedJob = await repository.completeNotificationJob({
          delivery,
          jobId: job.id,
          status: delivery.status,
        });

        await repository.recordNotificationAudit({
          action: "PROCESS_QUEUE_JOB",
          details: delivery,
          eventId: job.eventId,
          queueId: job.id,
          status: delivery.status,
        });
        processed.push({ delivery, job: completedJob || job });
      } catch (error) {
        const failedJob = await repository.failNotificationJob({
          errorMessage: readErrorMessage(error),
          job,
          nextAttemptAt: nextAttemptAt(job, this.clock()),
        });

        await repository.recordNotificationAudit({
          action: "QUEUE_JOB_FAILED",
          details: { errorMessage: readErrorMessage(error) },
          eventId: job.eventId,
          queueId: job.id,
          status: failedJob?.status || AgendaNotificationDeliveryStatus.FAILED,
        });
        processed.push({ error: readErrorMessage(error), job: failedJob || job });
      }
    }

    return {
      asyncProcessing: true,
      processed,
      processedCount: processed.length,
      queueEmpty: processed.length === 0,
      retryEnabled: true,
    };
  }

  /**
   * @param {Record<string, unknown>} job
   * @returns {Promise<Record<string, unknown>>}
   */
  async dispatchJob(job = {}) {
    const channel = normalizeUpper(job.channel);

    if (channel === AgendaNotificationChannel.IN_APP) {
      const repository = this.getRepository(["createNotificationRecord"]);
      const notification = await repository.createNotificationRecord({
        eventId: job.eventId,
        message: job.message,
        notificationType: job.notificationType,
        queueId: job.id,
        recipientId: job.recipientId,
        recipientType: job.recipientType,
        title: job.title,
      });

      return {
        channel,
        notification,
        status: AgendaNotificationDeliveryStatus.SENT,
      };
    }

    const adapter = this.adapters[channel.toLowerCase()];

    if (adapter && typeof adapter.send === "function") {
      return adapter.send(job);
    }

    return {
      channel,
      externalAdapterPrepared: true,
      sent: false,
      status: AgendaNotificationDeliveryStatus.PREPARED,
    };
  }

  listNotifications(input = {}) {
    return this.getRepository(["listNotificationCenter"]).listNotificationCenter(input);
  }

  countUnread(input = {}) {
    return this.getRepository(["countUnreadNotifications"]).countUnreadNotifications(input);
  }

  async markAsRead(input = {}) {
    const repository = this.getRepository(["markNotificationRead"]);
    const notification = await repository.markNotificationRead(input);

    if (!notification) {
      throw controlledError("Notificacao nao encontrada.", AGENDA_NOTIFICATION_NOT_FOUND_CODE);
    }

    return notification;
  }

  markAllAsRead(input = {}) {
    return this.getRepository(["markAllNotificationsRead"]).markAllNotificationsRead(input);
  }

  listHistory(input = {}) {
    return this.getRepository(["listNotificationHistory"]).listNotificationHistory(input);
  }

  getPreferences(input = {}) {
    return this.getRepository(["listNotificationPreferences"]).listNotificationPreferences(input);
  }

  updatePreferences(input = {}) {
    return this.getRepository(["upsertNotificationPreference"]).upsertNotificationPreference(input);
  }

  /**
   * @param {string[]} methods
   * @returns {Record<string, Function>}
   */
  getRepository(methods = []) {
    const repository = this.notificationRepository;

    if (!repository || typeof repository !== "object") {
      throw controlledError(
        "AgendaNotificationService requires a notificationRepository.",
        AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE,
      );
    }

    for (const method of methods) {
      if (typeof repository[method] !== "function") {
        throw controlledError(
          `AgendaNotificationService requires notificationRepository.${method}.`,
          AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE,
          { method },
        );
      }
    }

    return repository;
  }
}

function evaluateNotificationPreference(preference, { channel, clock, notificationType }) {
  const normalizedPreference =
    preference && typeof preference === "object" && !Array.isArray(preference) ? preference : {};

  if (normalizedPreference.enabled === false || Number(normalizedPreference.enabled) === 0) {
    return { allowed: false, reason: "CHANNEL_DISABLED" };
  }

  if (normalizedPreference.mutedUntil) {
    const mutedUntil = new Date(normalizedPreference.mutedUntil);

    if (!Number.isNaN(mutedUntil.getTime()) && mutedUntil > clock()) {
      return {
        allowed: false,
        mutedUntil: mutedUntil.toISOString(),
        reason: "MUTED",
      };
    }
  }

  const allowedTypes = normalizeStringArray(
    normalizedPreference.allowedTypes || normalizedPreference.allowed_types,
  );

  if (allowedTypes.length > 0 && !allowedTypes.includes(normalizeUpper(notificationType))) {
    return { allowed: false, reason: "TYPE_DISABLED" };
  }

  if (!isWithinAllowedHours(normalizedPreference, clock())) {
    return { allowed: false, channel, reason: "OUTSIDE_ALLOWED_HOURS" };
  }

  return { allowed: true };
}

function isWithinAllowedHours(preference, now) {
  const allowedStart = normalizeTime(preference.allowedStart || preference.allowed_start);
  const allowedEnd = normalizeTime(preference.allowedEnd || preference.allowed_end);

  if (!allowedStart || !allowedEnd) {
    return true;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(allowedStart);
  const endMinutes = toMinutes(allowedEnd);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function nextAttemptAt(job, now) {
  const attempts = Number(job.attempts || 0) + 1;
  const next = new Date(now.getTime() + Math.min(attempts * 5, 60) * 60 * 1000);
  return next.toISOString();
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 200) : fallback;
}

function normalizeStringArray(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeStringArray(parsed) : [];
    } catch {
      return value.split(/[|,;]/g).map(normalizeUpper).filter(Boolean);
    }
  }

  return Array.isArray(value) ? value.map(normalizeUpper).filter(Boolean) : [];
}

function normalizeTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? "").trim());

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeUpper(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.toUpperCase() : null;
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  AGENDA_NOTIFICATION_NOT_FOUND_CODE,
  AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE,
  AgendaNotificationService,
  evaluateNotificationPreference,
};
