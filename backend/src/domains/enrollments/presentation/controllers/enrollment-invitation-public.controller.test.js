const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentInvitationPublicController,
} = require("./enrollment-invitation-public.controller.js");
const {
  RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
} = require("../../application/services/resolve-enrollment-invitation-application.service.js");

test("EnrollmentInvitationPublicController returns a minimal success envelope without token data", async () => {
  const controller = new EnrollmentInvitationPublicController({
    resolveEnrollmentInvitationService: {
      async resolveByToken(command) {
        assert.deepEqual(command, { rawToken: "A".repeat(43) });
        return {
          enrollmentId: "enrollment-draft",
          invitationId: "invitation-1",
          status: "ACTIVE",
          unitId: "unit-1",
        };
      },
    },
  });
  const res = createResponse();

  await controller.getByToken({ params: { token: "A".repeat(43) } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.invitationId, "invitation-1");
  assert.equal(JSON.stringify(res.body).includes("A".repeat(43)), false);
  assert.equal(JSON.stringify(res.body).includes("tokenHash"), false);
});

test("EnrollmentInvitationPublicController returns the same generic response for every failure", async () => {
  const controller = new EnrollmentInvitationPublicController({
    logger: {
      warn(_message, context) {
        assert.equal(JSON.stringify(context).includes("A".repeat(43)), false);
      },
    },
    resolveEnrollmentInvitationService: {
      async resolveByToken() {
        const error = new Error("internal details");
        error.code = "ANY_INTERNAL_CODE";
        throw error;
      },
    },
  });
  const res = createResponse();

  await controller.getByToken({ params: { token: "A".repeat(43) } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    code: RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
    error: "Convite de matricula indisponivel.",
    success: false,
  });
});

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
