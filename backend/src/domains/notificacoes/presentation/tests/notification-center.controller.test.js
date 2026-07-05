const assert = require("node:assert/strict");
const test = require("node:test");

const {
  NotificationCenterController,
  resolveRecipientScope,
} = require("../controllers/notification-center.controller.js");

test("resolveRecipientScope maps authenticated roles to notification recipients", () => {
  assert.deepEqual(
    resolveRecipientScope(
      {
        auth: {
          aluno_id: 10,
          role: "aluno",
        },
        query: {},
      },
      { canManageSystem: () => false },
    ),
    { recipientId: "10", recipientType: "STUDENT" },
  );

  assert.deepEqual(
    resolveRecipientScope(
      {
        auth: {
          professor_id: 7,
          role: "professor",
        },
        query: {},
      },
      { canManageSystem: () => false },
    ),
    { recipientId: "7", recipientType: "PROFESSOR" },
  );
});

test("NotificationCenterController lists notifications with unread count", async () => {
  const controller = new NotificationCenterController({
    canManageSystem: () => true,
    notificationFacade: {
      countUnread: async () => 2,
      listNotifications: async () => [{ id: "ntf_1" }],
    },
  });
  const response = createResponse();

  await controller.listNotifications(
    {
      auth: { id: "usr-admin", role: "admin" },
      query: {},
    },
    response,
    assert.ifError,
  );

  assert.equal(response.payload.success, true);
  assert.equal(response.payload.data.unreadCount, 2);
  assert.equal(response.payload.data.items[0].id, "ntf_1");
});

test("NotificationCenterController marks all notifications as read", async () => {
  const controller = new NotificationCenterController({
    canManageSystem: () => false,
    notificationFacade: {
      markAllAsRead: async (input) => ({ markedCount: input.recipientId === "42" ? 3 : 0 }),
    },
  });
  const response = createResponse();

  await controller.markAllAsRead(
    {
      auth: { aluno_id: 42, role: "aluno" },
      query: {},
    },
    response,
    assert.ifError,
  );

  assert.equal(response.payload.data.markedCount, 3);
});

function createResponse() {
  return {
    payload: null,
    statusCode: 200,
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
