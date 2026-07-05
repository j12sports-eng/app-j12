const crypto = require("node:crypto");

const {
  AgendaNotificationDeliveryStatus,
} = require("../../application/contracts/agenda-notification.contract.js");

const AGENDA_NOTIFICATION_EVENTS_TABLE = "agenda_notification_events";
const AGENDA_NOTIFICATIONS_TABLE = "agenda_notifications";
const AGENDA_NOTIFICATION_QUEUE_TABLE = "agenda_notification_queue";
const AGENDA_NOTIFICATION_PREFERENCES_TABLE = "agenda_notification_preferences";
const AGENDA_NOTIFICATION_AUDIT_TABLE = "agenda_notification_audit_logs";

const INSERT_AGENDA_NOTIFICATION_EVENT_SQL = `
  INSERT INTO agenda_notification_events (
    id,
    event_type,
    agenda_item_id,
    recurrence_series_id,
    occurrence_key,
    class_id,
    payload_json,
    actor_id,
    idempotency_key,
    status,
    occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP
`;

const SELECT_AGENDA_NOTIFICATION_EVENT_BY_IDEMPOTENCY_KEY_SQL = `
  SELECT
    id,
    event_type,
    agenda_item_id,
    recurrence_series_id,
    occurrence_key,
    class_id,
    payload_json,
    actor_id,
    idempotency_key,
    status,
    occurred_at,
    created_at,
    updated_at
  FROM agenda_notification_events
  WHERE idempotency_key = ?
  LIMIT 1
`;

const INSERT_AGENDA_NOTIFICATION_QUEUE_SQL = `
  INSERT INTO agenda_notification_queue (
    id,
    event_id,
    recipient_type,
    recipient_id,
    channel,
    title,
    message,
    notification_type,
    status,
    attempts,
    max_attempts,
    scheduled_at,
    idempotency_key,
    payload_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP
`;

const SELECT_AGENDA_NOTIFICATION_QUEUE_BY_IDEMPOTENCY_KEY_SQL = `
  SELECT
    id,
    event_id,
    notification_id,
    recipient_type,
    recipient_id,
    channel,
    title,
    message,
    notification_type,
    status,
    attempts,
    max_attempts,
    scheduled_at,
    processed_at,
    next_attempt_at,
    last_error,
    delivery_json,
    idempotency_key,
    payload_json,
    created_at,
    updated_at
  FROM agenda_notification_queue
  WHERE idempotency_key = ?
  LIMIT 1
`;

const SELECT_AGENDA_NOTIFICATION_QUEUE_BY_ID_SQL = `
  SELECT
    id,
    event_id,
    notification_id,
    recipient_type,
    recipient_id,
    channel,
    title,
    message,
    notification_type,
    status,
    attempts,
    max_attempts,
    scheduled_at,
    processed_at,
    next_attempt_at,
    last_error,
    delivery_json,
    idempotency_key,
    payload_json,
    created_at,
    updated_at
  FROM agenda_notification_queue
  WHERE id = ?
  LIMIT 1
`;

const SELECT_NOTIFICATION_PREFERENCE_SQL = `
  SELECT
    id,
    recipient_type,
    recipient_id,
    channel,
    notification_type,
    enabled,
    muted_until,
    allowed_start,
    allowed_end,
    allowed_types_json,
    updated_by,
    created_at,
    updated_at
  FROM agenda_notification_preferences
  WHERE recipient_type = ?
    AND recipient_id = ?
    AND channel = ?
    AND notification_type IN (?, 'AGENDA', '*')
  ORDER BY
    CASE notification_type
      WHEN ? THEN 1
      WHEN 'AGENDA' THEN 2
      ELSE 3
    END ASC,
    updated_at DESC
  LIMIT 1
`;

const SELECT_PENDING_NOTIFICATION_JOBS_SQL = `
  SELECT
    id,
    event_id,
    notification_id,
    recipient_type,
    recipient_id,
    channel,
    title,
    message,
    notification_type,
    status,
    attempts,
    max_attempts,
    scheduled_at,
    processed_at,
    next_attempt_at,
    last_error,
    delivery_json,
    idempotency_key,
    payload_json,
    created_at,
    updated_at
  FROM agenda_notification_queue
  WHERE status IN ('PENDING', 'RETRY')
    AND scheduled_at <= ?
    AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
  ORDER BY scheduled_at ASC, created_at ASC, id ASC
`;

const INSERT_NOTIFICATION_RECORD_SQL = `
  INSERT INTO agenda_notifications (
    id,
    event_id,
    queue_id,
    recipient_type,
    recipient_id,
    title,
    message,
    notification_type,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP
`;

const SELECT_NOTIFICATION_BY_ID_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    recipient_type,
    recipient_id,
    title,
    message,
    notification_type,
    status,
    read_at,
    created_at,
    updated_at
  FROM agenda_notifications
  WHERE id = ?
  LIMIT 1
`;

const SELECT_NOTIFICATION_BY_QUEUE_ID_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    recipient_type,
    recipient_id,
    title,
    message,
    notification_type,
    status,
    read_at,
    created_at,
    updated_at
  FROM agenda_notifications
  WHERE queue_id = ?
  LIMIT 1
`;

const SELECT_NOTIFICATION_BY_RECIPIENT_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    recipient_type,
    recipient_id,
    title,
    message,
    notification_type,
    status,
    read_at,
    created_at,
    updated_at
  FROM agenda_notifications
  WHERE id = ?
    AND recipient_type = ?
    AND recipient_id = ?
  LIMIT 1
`;

const UPDATE_NOTIFICATION_JOB_COMPLETE_SQL = `
  UPDATE agenda_notification_queue
  SET
    notification_id = COALESCE(?, notification_id),
    status = ?,
    processed_at = CURRENT_TIMESTAMP,
    delivery_json = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

const UPDATE_NOTIFICATION_JOB_FAILED_SQL = `
  UPDATE agenda_notification_queue
  SET
    status = ?,
    attempts = attempts + 1,
    next_attempt_at = ?,
    processed_at = CASE WHEN ? = 'FAILED' THEN CURRENT_TIMESTAMP ELSE processed_at END,
    last_error = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

const SELECT_NOTIFICATION_CENTER_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    recipient_type,
    recipient_id,
    title,
    message,
    notification_type,
    status,
    read_at,
    created_at,
    updated_at
  FROM agenda_notifications
  WHERE recipient_type = ?
    AND recipient_id = ?
  ORDER BY created_at DESC, id DESC
`;

const COUNT_UNREAD_NOTIFICATIONS_SQL = `
  SELECT COUNT(*) AS total
  FROM agenda_notifications
  WHERE recipient_type = ?
    AND recipient_id = ?
    AND read_at IS NULL
    AND status = 'UNREAD'
`;

const UPDATE_NOTIFICATION_READ_SQL = `
  UPDATE agenda_notifications
  SET
    status = 'READ',
    read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND recipient_type = ?
    AND recipient_id = ?
`;

const UPDATE_ALL_NOTIFICATIONS_READ_SQL = `
  UPDATE agenda_notifications
  SET
    status = 'READ',
    read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
  WHERE recipient_type = ?
    AND recipient_id = ?
    AND read_at IS NULL
`;

const SELECT_NOTIFICATION_HISTORY_BY_NOTIFICATION_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    notification_id,
    action,
    status,
    recipient_type,
    recipient_id,
    details_json,
    created_by,
    created_at
  FROM agenda_notification_audit_logs
  WHERE notification_id = ?
  ORDER BY created_at DESC, id DESC
`;

const SELECT_NOTIFICATION_HISTORY_BY_EVENT_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    notification_id,
    action,
    status,
    recipient_type,
    recipient_id,
    details_json,
    created_by,
    created_at
  FROM agenda_notification_audit_logs
  WHERE event_id = ?
  ORDER BY created_at DESC, id DESC
`;

const SELECT_NOTIFICATION_HISTORY_BY_RECIPIENT_SQL = `
  SELECT
    id,
    event_id,
    queue_id,
    notification_id,
    action,
    status,
    recipient_type,
    recipient_id,
    details_json,
    created_by,
    created_at
  FROM agenda_notification_audit_logs
  WHERE recipient_type = ?
    AND recipient_id = ?
  ORDER BY created_at DESC, id DESC
`;

const SELECT_NOTIFICATION_PREFERENCES_SQL = `
  SELECT
    id,
    recipient_type,
    recipient_id,
    channel,
    notification_type,
    enabled,
    muted_until,
    allowed_start,
    allowed_end,
    allowed_types_json,
    updated_by,
    created_at,
    updated_at
  FROM agenda_notification_preferences
  WHERE recipient_type = ?
    AND recipient_id = ?
  ORDER BY channel ASC, notification_type ASC
`;

const UPSERT_NOTIFICATION_PREFERENCE_SQL = `
  INSERT INTO agenda_notification_preferences (
    id,
    recipient_type,
    recipient_id,
    channel,
    notification_type,
    enabled,
    muted_until,
    allowed_start,
    allowed_end,
    allowed_types_json,
    updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    enabled = VALUES(enabled),
    muted_until = VALUES(muted_until),
    allowed_start = VALUES(allowed_start),
    allowed_end = VALUES(allowed_end),
    allowed_types_json = VALUES(allowed_types_json),
    updated_by = VALUES(updated_by),
    updated_at = CURRENT_TIMESTAMP
`;

const INSERT_NOTIFICATION_AUDIT_SQL = `
  INSERT INTO agenda_notification_audit_logs (
    id,
    event_id,
    queue_id,
    notification_id,
    action,
    status,
    recipient_type,
    recipient_id,
    details_json,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

class MySqlNotificationRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  async createAgendaNotificationEvent(event = {}) {
    const idempotencyKey = requiredText(event.idempotencyKey, "idempotencyKey", 191);
    const id = nullableText(event.id, 64) || buildStableId("agn_evt", idempotencyKey);
    const status = nullableText(event.status, 32) || "RECORDED";
    const occurredAt = normalizeDateTime(event.occurredAt) || new Date().toISOString();

    await this.query(INSERT_AGENDA_NOTIFICATION_EVENT_SQL, [
      id,
      requiredText(event.eventType, "eventType", 64),
      nullableText(event.agendaItemId, 64),
      nullableText(event.recurrenceSeriesId, 64),
      nullableText(event.occurrenceKey, 191),
      nullableText(event.classId, 64),
      stringifyJsonOrNull({
        channels: event.channels,
        message: event.message,
        metadata: event.metadata,
        notificationType: event.notificationType,
        recipients: event.recipients,
        title: event.title,
      }),
      requiredText(event.actorId, "actorId", 191),
      idempotencyKey,
      status,
      toMysqlDateTime(occurredAt),
    ]);

    const rows = await this.query(SELECT_AGENDA_NOTIFICATION_EVENT_BY_IDEMPOTENCY_KEY_SQL, [
      idempotencyKey,
    ]);

    return toNotificationEventData(readRows(rows)[0]);
  }

  async enqueueNotificationJob(input = {}) {
    const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey", 191);
    const event = readObject(input.event);
    const recipient = readObject(input.recipient);
    const id = nullableText(input.id, 64) || buildStableId("agn_job", idempotencyKey);
    const scheduledAt = toMysqlDateTime(normalizeDateTime(input.scheduledAt) || new Date());
    const maxAttempts = normalizePositiveInteger(input.maxAttempts, 3);

    await this.query(INSERT_AGENDA_NOTIFICATION_QUEUE_SQL, [
      id,
      requiredText(event.id || input.eventId, "eventId", 64),
      requiredText(recipient.recipientType || input.recipientType, "recipientType", 32),
      requiredText(recipient.recipientId || input.recipientId, "recipientId", 191),
      requiredText(input.channel, "channel", 32),
      requiredText(input.title, "title", 160),
      requiredText(input.message, "message", 500),
      requiredText(input.notificationType, "notificationType", 64),
      AgendaNotificationDeliveryStatus.PENDING,
      maxAttempts,
      scheduledAt,
      idempotencyKey,
      stringifyJsonOrNull({
        eventType: input.eventType,
        recipient,
      }),
    ]);

    const rows = await this.query(SELECT_AGENDA_NOTIFICATION_QUEUE_BY_IDEMPOTENCY_KEY_SQL, [
      idempotencyKey,
    ]);

    return toNotificationJobData(readRows(rows)[0]);
  }

  async findNotificationPreference(input = {}) {
    const notificationType = requiredText(input.notificationType || "AGENDA", "notificationType", 64);
    const rows = await this.query(SELECT_NOTIFICATION_PREFERENCE_SQL, [
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
      requiredText(input.channel, "channel", 32),
      notificationType,
      notificationType,
    ]);

    return toNotificationPreferenceData(readRows(rows)[0]);
  }

  async recordNotificationAudit(input = {}) {
    const id = nullableText(input.id, 64) || buildStableId("agn_aud", [
      input.eventId,
      input.queueId,
      input.notificationId,
      input.action,
      input.status,
      Date.now(),
      Math.random(),
    ].join(":"));

    await this.query(INSERT_NOTIFICATION_AUDIT_SQL, [
      id,
      nullableText(input.eventId, 64),
      nullableText(input.queueId, 64),
      nullableText(input.notificationId, 64),
      requiredText(input.action, "action", 64),
      nullableText(input.status, 32),
      nullableText(input.recipientType, 32),
      nullableText(input.recipientId, 191),
      stringifyJsonOrNull(input.details),
      nullableText(input.createdBy, 191),
    ]);

    return {
      auditLogged: true,
      id,
    };
  }

  async listPendingNotificationJobs(input = {}) {
    const limit = normalizeLimit(input.limit, 50);
    const now = toMysqlDateTime(normalizeDateTime(input.now) || new Date());
    const rows = await this.query(`${SELECT_PENDING_NOTIFICATION_JOBS_SQL} LIMIT ${limit}`, [
      now,
      now,
    ]);

    return readRows(rows).map(toNotificationJobData);
  }

  async createNotificationRecord(input = {}) {
    const seed = input.queueId || [
      input.eventId,
      input.recipientType,
      input.recipientId,
      input.notificationType,
    ].join(":");
    const id = nullableText(input.id, 64) || buildStableId("agn_ntf", seed);

    await this.query(INSERT_NOTIFICATION_RECORD_SQL, [
      id,
      requiredText(input.eventId, "eventId", 64),
      nullableText(input.queueId, 64),
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
      requiredText(input.title, "title", 160),
      requiredText(input.message, "message", 500),
      requiredText(input.notificationType, "notificationType", 64),
      AgendaNotificationDeliveryStatus.UNREAD,
    ]);

    const rows = input.queueId
      ? await this.query(SELECT_NOTIFICATION_BY_QUEUE_ID_SQL, [input.queueId])
      : await this.query(SELECT_NOTIFICATION_BY_ID_SQL, [id]);
    const notification = toNotificationData(readRows(rows)[0]);

    emitNotificationCreated(notification);

    return notification;
  }

  async completeNotificationJob(input = {}) {
    const delivery = readObject(input.delivery);
    const notification = readObject(delivery.notification);
    const notificationId = nullableText(notification.id, 64);
    const status = requiredText(input.status, "status", 32);
    const jobId = requiredText(input.jobId, "jobId", 64);

    await this.query(UPDATE_NOTIFICATION_JOB_COMPLETE_SQL, [
      notificationId,
      status,
      stringifyJsonOrNull(delivery),
      jobId,
    ]);

    const rows = await this.query(SELECT_AGENDA_NOTIFICATION_QUEUE_BY_ID_SQL, [jobId]);
    return toNotificationJobData(readRows(rows)[0]);
  }

  async failNotificationJob(input = {}) {
    const job = readObject(input.job);
    const jobId = requiredText(job.id || input.jobId, "jobId", 64);
    const nextAttempts = Number(job.attempts || 0) + 1;
    const maxAttempts = normalizePositiveInteger(job.maxAttempts || job.max_attempts, 3);
    const status =
      nextAttempts >= maxAttempts
        ? AgendaNotificationDeliveryStatus.FAILED
        : AgendaNotificationDeliveryStatus.RETRY;

    await this.query(UPDATE_NOTIFICATION_JOB_FAILED_SQL, [
      status,
      status === AgendaNotificationDeliveryStatus.FAILED
        ? null
        : toMysqlDateTime(normalizeDateTime(input.nextAttemptAt) || new Date()),
      status,
      nullableText(input.errorMessage, 1000),
      jobId,
    ]);

    const rows = await this.query(SELECT_AGENDA_NOTIFICATION_QUEUE_BY_ID_SQL, [jobId]);
    return toNotificationJobData(readRows(rows)[0]);
  }

  async listNotificationCenter(input = {}) {
    const limit = normalizeLimit(input.limit, 50);
    const rows = await this.query(`${SELECT_NOTIFICATION_CENTER_SQL} LIMIT ${limit}`, [
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
    ]);

    return readRows(rows).map(toNotificationData);
  }

  async countUnreadNotifications(input = {}) {
    const rows = await this.query(COUNT_UNREAD_NOTIFICATIONS_SQL, [
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
    ]);

    return Number(readRows(rows)[0]?.total || 0);
  }

  async markNotificationRead(input = {}) {
    const notificationId = requiredText(input.notificationId || input.id, "notificationId", 64);
    const recipientType = requiredText(input.recipientType, "recipientType", 32);
    const recipientId = requiredText(input.recipientId, "recipientId", 191);

    await this.query(UPDATE_NOTIFICATION_READ_SQL, [notificationId, recipientType, recipientId]);

    const rows = await this.query(SELECT_NOTIFICATION_BY_RECIPIENT_SQL, [
      notificationId,
      recipientType,
      recipientId,
    ]);

    return toNotificationData(readRows(rows)[0]);
  }

  async markAllNotificationsRead(input = {}) {
    const result = await this.query(UPDATE_ALL_NOTIFICATIONS_READ_SQL, [
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
    ]);
    const mutation = readMutationResult(result);

    return {
      markedCount: Number(mutation?.affectedRows ?? mutation?.changedRows ?? 0),
      readAll: true,
    };
  }

  async listNotificationHistory(input = {}) {
    const limit = normalizeLimit(input.limit, 100);
    let rows;

    if (input.notificationId || input.id) {
      rows = await this.query(`${SELECT_NOTIFICATION_HISTORY_BY_NOTIFICATION_SQL} LIMIT ${limit}`, [
        requiredText(input.notificationId || input.id, "notificationId", 64),
      ]);
    } else if (input.eventId) {
      rows = await this.query(`${SELECT_NOTIFICATION_HISTORY_BY_EVENT_SQL} LIMIT ${limit}`, [
        requiredText(input.eventId, "eventId", 64),
      ]);
    } else {
      rows = await this.query(`${SELECT_NOTIFICATION_HISTORY_BY_RECIPIENT_SQL} LIMIT ${limit}`, [
        requiredText(input.recipientType, "recipientType", 32),
        requiredText(input.recipientId, "recipientId", 191),
      ]);
    }

    return readRows(rows).map(toNotificationAuditData);
  }

  async listNotificationPreferences(input = {}) {
    const rows = await this.query(SELECT_NOTIFICATION_PREFERENCES_SQL, [
      requiredText(input.recipientType, "recipientType", 32),
      requiredText(input.recipientId, "recipientId", 191),
    ]);

    return readRows(rows).map(toNotificationPreferenceData);
  }

  async upsertNotificationPreference(input = {}) {
    const preferences = normalizePreferenceInputs(input);
    const saved = [];

    for (const preference of preferences) {
      const recipientType = requiredText(preference.recipientType, "recipientType", 32);
      const recipientId = requiredText(preference.recipientId, "recipientId", 191);
      const channel = requiredText(preference.channel, "channel", 32).toUpperCase();
      const notificationType = requiredText(
        preference.notificationType || "AGENDA",
        "notificationType",
        64,
      ).toUpperCase();
      const seed = [recipientType, recipientId, channel, notificationType].join(":");

      await this.query(UPSERT_NOTIFICATION_PREFERENCE_SQL, [
        nullableText(preference.id, 64) || buildStableId("agn_prf", seed),
        recipientType,
        recipientId,
        channel,
        notificationType,
        preference.enabled === false || Number(preference.enabled) === 0 ? 0 : 1,
        preference.mutedUntil ? toMysqlDateTime(normalizeDateTime(preference.mutedUntil)) : null,
        nullableText(preference.allowedStart || preference.allowed_start, 20),
        nullableText(preference.allowedEnd || preference.allowed_end, 20),
        stringifyJsonOrNull(
          Array.isArray(preference.allowedTypes || preference.allowed_types)
            ? preference.allowedTypes || preference.allowed_types
            : [],
        ),
        nullableText(preference.updatedBy, 191),
      ]);
      saved.push({ channel, notificationType, recipientId, recipientType });
    }

    return {
      preferences: await this.listNotificationPreferences({
        recipientId: preferences[0]?.recipientId,
        recipientType: preferences[0]?.recipientType,
      }),
      savedCount: saved.length,
    };
  }
}

function normalizePreferenceInputs(input = {}) {
  const source = Array.isArray(input.preferences) ? input.preferences : [input];
  return source.map((item) => ({
    ...readObject(item),
    recipientId: readObject(item).recipientId ?? input.recipientId,
    recipientType: readObject(item).recipientType ?? input.recipientType,
    updatedBy: readObject(item).updatedBy ?? input.updatedBy,
  }));
}

function toNotificationEventData(row) {
  if (!row) return null;

  return {
    actorId: nullableText(row.actor_id, 191),
    agendaItemId: nullableText(row.agenda_item_id, 64),
    classId: nullableText(row.class_id, 64),
    createdAt: row.created_at ?? null,
    eventType: nullableText(row.event_type, 64),
    id: nullableText(row.id, 64),
    idempotencyKey: nullableText(row.idempotency_key, 191),
    occurredAt: row.occurred_at ?? null,
    occurrenceKey: nullableText(row.occurrence_key, 191),
    payload: parseJsonObject(row.payload_json),
    recurrenceSeriesId: nullableText(row.recurrence_series_id, 64),
    status: nullableText(row.status, 32),
    updatedAt: row.updated_at ?? null,
  };
}

function toNotificationJobData(row) {
  if (!row) return null;

  return {
    attempts: Number(row.attempts || 0),
    channel: nullableText(row.channel, 32),
    createdAt: row.created_at ?? null,
    delivery: parseJsonObject(row.delivery_json),
    eventId: nullableText(row.event_id, 64),
    id: nullableText(row.id, 64),
    idempotencyKey: nullableText(row.idempotency_key, 191),
    lastError: nullableText(row.last_error, 1000),
    maxAttempts: Number(row.max_attempts || 3),
    message: nullableText(row.message, 500),
    nextAttemptAt: row.next_attempt_at ?? null,
    notificationId: nullableText(row.notification_id, 64),
    notificationType: nullableText(row.notification_type, 64),
    payload: parseJsonObject(row.payload_json),
    processedAt: row.processed_at ?? null,
    recipientId: nullableText(row.recipient_id, 191),
    recipientType: nullableText(row.recipient_type, 32),
    scheduledAt: row.scheduled_at ?? null,
    status: nullableText(row.status, 32),
    title: nullableText(row.title, 160),
    updatedAt: row.updated_at ?? null,
  };
}

function toNotificationData(row) {
  if (!row) return null;

  const readAt = row.read_at ?? null;

  return {
    createdAt: row.created_at ?? null,
    eventId: nullableText(row.event_id, 64),
    id: nullableText(row.id, 64),
    isRecurringAgendaNotification: true,
    lida: Boolean(readAt) || nullableText(row.status, 32) === AgendaNotificationDeliveryStatus.READ,
    message: nullableText(row.message, 500),
    mensagem: nullableText(row.message, 500),
    notificationType: nullableText(row.notification_type, 64),
    queueId: nullableText(row.queue_id, 64),
    readAt,
    recipientId: nullableText(row.recipient_id, 191),
    recipientType: nullableText(row.recipient_type, 32),
    status: nullableText(row.status, 32),
    title: nullableText(row.title, 160),
    titulo: nullableText(row.title, 160),
    type: nullableText(row.notification_type, 64),
    tipo: nullableText(row.notification_type, 64),
    updatedAt: row.updated_at ?? null,
  };
}

function toNotificationPreferenceData(row) {
  if (!row) return null;

  return {
    allowedEnd: nullableText(row.allowed_end, 20),
    allowedStart: nullableText(row.allowed_start, 20),
    allowedTypes: parseJsonArray(row.allowed_types_json),
    channel: nullableText(row.channel, 32),
    createdAt: row.created_at ?? null,
    enabled: row.enabled === true || Number(row.enabled) === 1,
    id: nullableText(row.id, 64),
    mutedUntil: row.muted_until ?? null,
    notificationType: nullableText(row.notification_type, 64),
    recipientId: nullableText(row.recipient_id, 191),
    recipientType: nullableText(row.recipient_type, 32),
    updatedAt: row.updated_at ?? null,
    updatedBy: nullableText(row.updated_by, 191),
  };
}

function toNotificationAuditData(row) {
  if (!row) return null;

  return {
    action: nullableText(row.action, 64),
    createdAt: row.created_at ?? null,
    createdBy: nullableText(row.created_by, 191),
    details: parseJsonObject(row.details_json),
    eventId: nullableText(row.event_id, 64),
    id: nullableText(row.id, 64),
    notificationId: nullableText(row.notification_id, 64),
    queueId: nullableText(row.queue_id, 64),
    recipientId: nullableText(row.recipient_id, 191),
    recipientType: nullableText(row.recipient_type, 32),
    status: nullableText(row.status, 32),
  };
}

function emitNotificationCreated(notification) {
  if (!notification || !global.io || typeof global.io.emit !== "function") {
    return;
  }

  global.io.emit("nova_notificacao", notification);
}

function readRows(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function readMutationResult(result) {
  if (Array.isArray(result)) {
    const [first] = result;
    return first && typeof first === "object" && !Array.isArray(first) ? first : null;
  }

  return result && typeof result === "object" && !Array.isArray(result) ? result : null;
}

function parseJsonObject(value) {
  const raw = nullableText(value, 65535);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  const raw = nullableText(value, 65535);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyJsonOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function normalizeDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const normalized = nullableText(value, 64);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMysqlDateTime(value) {
  const date = normalizeDateTime(value) || new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + " " + [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 200) : fallback;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildStableId(prefix, seed) {
  return `${prefix}_${crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 24)}`;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlNotificationRepository requires ${field}.`);
  }

  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  AGENDA_NOTIFICATION_AUDIT_TABLE,
  AGENDA_NOTIFICATION_EVENTS_TABLE,
  AGENDA_NOTIFICATION_PREFERENCES_TABLE,
  AGENDA_NOTIFICATION_QUEUE_TABLE,
  AGENDA_NOTIFICATIONS_TABLE,
  COUNT_UNREAD_NOTIFICATIONS_SQL,
  INSERT_AGENDA_NOTIFICATION_EVENT_SQL,
  INSERT_AGENDA_NOTIFICATION_QUEUE_SQL,
  INSERT_NOTIFICATION_AUDIT_SQL,
  INSERT_NOTIFICATION_RECORD_SQL,
  MySqlNotificationRepository,
  SELECT_AGENDA_NOTIFICATION_EVENT_BY_IDEMPOTENCY_KEY_SQL,
  SELECT_AGENDA_NOTIFICATION_QUEUE_BY_IDEMPOTENCY_KEY_SQL,
  SELECT_AGENDA_NOTIFICATION_QUEUE_BY_ID_SQL,
  SELECT_NOTIFICATION_CENTER_SQL,
  SELECT_NOTIFICATION_HISTORY_BY_EVENT_SQL,
  SELECT_NOTIFICATION_HISTORY_BY_NOTIFICATION_SQL,
  SELECT_NOTIFICATION_HISTORY_BY_RECIPIENT_SQL,
  SELECT_NOTIFICATION_PREFERENCES_SQL,
  SELECT_NOTIFICATION_PREFERENCE_SQL,
  UPDATE_ALL_NOTIFICATIONS_READ_SQL,
  UPDATE_NOTIFICATION_JOB_COMPLETE_SQL,
  UPDATE_NOTIFICATION_JOB_FAILED_SQL,
  UPDATE_NOTIFICATION_READ_SQL,
  buildStableId,
  readRows,
  toNotificationData,
  toNotificationJobData,
  toNotificationPreferenceData,
};
