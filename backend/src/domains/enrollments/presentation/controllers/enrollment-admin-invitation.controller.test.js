const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentAdminController } = require("./enrollment-admin.controller.js");

const ACTOR_CONTEXT = Object.freeze({ unitContext: Object.freeze({ unitId: "12" }) });

test("admin controller delegates only enrollmentId and ActorContext and returns the safe projection", async () => {
  const calls = [];
  const data = {
    expiresAt: "2026-08-05 12:00:00",
    invitationId: "invitation-1",
    status: "ACTIVE",
    url: `/matricula-digital/${"A".repeat(43)}`,
  };
  const controller = new EnrollmentAdminController({
    facade: {
      async createDigitalEnrollmentInvitation(input, actorContext) {
        calls.push({ actorContext, input });
        return data;
      },
    },
  });
  const response = createResponse();

  await controller.createDigitalEnrollmentInvitation(
    { actorContext: ACTOR_CONTEXT, body: {}, params: { enrollmentId: "draft-1" } },
    response,
    rethrow,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls, [{ actorContext: ACTOR_CONTEXT, input: { enrollmentId: "draft-1" } }]);
  assert.deepEqual(response.body, { data, success: true });
  assert.deepEqual(Object.keys(response.body.data), ["expiresAt", "invitationId", "status", "url"]);
});

test("admin controller rejects body unitId and requires ActorContext", async (t) => {
  for (const request of [
    { actorContext: ACTOR_CONTEXT, body: { unitId: "999" }, params: { enrollmentId: "draft-1" } },
    { body: {}, params: { enrollmentId: "draft-1" } },
  ]) {
    await t.test(JSON.stringify(request.body), async () => {
      let called = false;
      const controller = new EnrollmentAdminController({
        facade: {
          async createDigitalEnrollmentInvitation() {
            called = true;
          },
        },
      });
      const response = createResponse();
      await controller.createDigitalEnrollmentInvitation(request, response, rethrow);
      assert.equal(response.statusCode, request.actorContext ? 400 : 403);
      assert.equal(called, false);
    });
  }
});

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function rethrow(error) {
  throw error;
}
