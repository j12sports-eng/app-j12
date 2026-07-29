const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentAdminController } = require("./enrollment-admin.controller.js");

const ACTOR_CONTEXT = Object.freeze({ unitContext: Object.freeze({ unitId: "12" }) });
const BODY = Object.freeze({
  responsiblePersonId: "responsible-1",
  startDate: "2026-08-01",
  studentPersonId: "student-1",
});

test("admin controller opens a DRAFT, ignores body unit selectors and uses ActorContext", async () => {
  const calls = [];
  const controller = new EnrollmentAdminController({
    facade: {
      async openDraftEnrollment(input, actorContext) {
        calls.push({ actorContext, input });
        return {
          created: true,
          enrollmentId: "draft-1",
          reused: false,
          startDate: BODY.startDate,
          status: "DRAFT",
        };
      },
    },
  });
  const response = createResponse();

  await controller.openDraft(
    { actorContext: ACTOR_CONTEXT, body: { ...BODY, unitId: "999", unit_id: "998" } },
    response,
    rethrow,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls, [{ actorContext: ACTOR_CONTEXT, input: BODY }]);
  assert.deepEqual(response.body, {
    data: {
      created: true,
      enrollmentId: "draft-1",
      reused: false,
      startDate: BODY.startDate,
      status: "DRAFT",
    },
    success: true,
  });
});

test("admin controller returns 200 when the canonical DRAFT is reused", async () => {
  const controller = new EnrollmentAdminController({
    facade: {
      async openDraftEnrollment() {
        return {
          created: false,
          enrollmentId: "draft-1",
          reused: true,
          startDate: BODY.startDate,
          status: "DRAFT",
        };
      },
    },
  });
  const response = createResponse();
  await controller.openDraft({ actorContext: ACTOR_CONTEXT, body: BODY }, response, rethrow);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.enrollmentId, "draft-1");
});

test("admin controller rejects status and internal ownership fields", async () => {
  let called = false;
  const controller = new EnrollmentAdminController({
    facade: {
      async openDraftEnrollment() {
        called = true;
      },
    },
  });
  const response = createResponse();
  await controller.openDraft(
    {
      actorContext: ACTOR_CONTEXT,
      body: { ...BODY, responsibleProfileId: "forged", status: "ACTIVE" },
    },
    response,
    rethrow,
  );
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "ENROLLMENT_OPEN_DRAFT_INPUT_INVALID");
  assert.equal(called, false);
});

test("admin controller requires trusted ActorContext", async () => {
  let called = false;
  const controller = new EnrollmentAdminController({
    facade: {
      async openDraftEnrollment() {
        called = true;
      },
    },
  });
  const response = createResponse();
  await controller.openDraft({ body: BODY }, response, rethrow);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED");
  assert.equal(called, false);
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
