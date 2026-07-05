const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INSERT_AGENDA_NOTIFICATION_EVENT_SQL,
  INSERT_AGENDA_NOTIFICATION_QUEUE_SQL,
  MySqlNotificationRepository,
  SELECT_NOTIFICATION_CENTER_SQL,
} = require("./mysql-notification.repository.js");

test("MySqlNotificationRepository creates Agenda notification events idempotently", async () => {
  const calls = [];
  const repository = new MySqlNotificationRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });

      if (String(sql).includes("FROM agenda_notification_events")) {
        return [
          {
            actor_id: "admin",
            event_type: "AGENDA_EVENT_CREATED",
            id: "evt_1",
            idempotency_key: "key_1",
            status: "RECORDED",
          },
        ];
      }

      return { affectedRows: 1 };
    },
  });

  const event = await repository.createAgendaNotificationEvent({
    actorId: "admin",
    eventType: "AGENDA_EVENT_CREATED",
    idempotencyKey: "key_1",
    recipients: [],
  });

  assert.equal(event.id, "evt_1");
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.equal(calls[0].sql, INSERT_AGENDA_NOTIFICATION_EVENT_SQL);
});

test("MySqlNotificationRepository enqueues jobs with unique idempotency keys", async () => {
  const calls = [];
  const repository = new MySqlNotificationRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });

      if (String(sql).includes("FROM agenda_notification_queue")) {
        return [
          {
            attempts: 0,
            channel: "IN_APP",
            event_id: "evt_1",
            id: "job_1",
            idempotency_key: "job_key",
            max_attempts: 3,
            message: "Mensagem",
            notification_type: "AGENDA_EVENT_CREATED",
            recipient_id: "1",
            recipient_type: "STUDENT",
            status: "PENDING",
            title: "Titulo",
          },
        ];
      }

      return { affectedRows: 1 };
    },
  });

  const job = await repository.enqueueNotificationJob({
    channel: "IN_APP",
    event: { id: "evt_1" },
    idempotencyKey: "job_key",
    message: "Mensagem",
    notificationType: "AGENDA_EVENT_CREATED",
    recipient: { recipientId: "1", recipientType: "STUDENT" },
    title: "Titulo",
  });

  assert.equal(job.id, "job_1");
  assert.equal(calls[0].sql, INSERT_AGENDA_NOTIFICATION_QUEUE_SQL);
  assert.equal(calls[0].params[11], "job_key");
});

test("MySqlNotificationRepository scopes notification center by recipient", async () => {
  const calls = [];
  const repository = new MySqlNotificationRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        {
          id: "ntf_1",
          message: "Mensagem",
          notification_type: "AGENDA_EVENT_REMINDER",
          recipient_id: "1",
          recipient_type: "STUDENT",
          status: "UNREAD",
          title: "Titulo",
        },
      ];
    },
  });

  const items = await repository.listNotificationCenter({
    limit: 20,
    recipientId: "1",
    recipientType: "STUDENT",
  });

  assert.equal(items[0].id, "ntf_1");
  assert.match(calls[0].sql, /LIMIT 20/);
  assert.match(calls[0].sql, new RegExp(SELECT_NOTIFICATION_CENTER_SQL.trim().slice(0, 32)));
  assert.deepEqual(calls[0].params, ["STUDENT", "1"]);
});
