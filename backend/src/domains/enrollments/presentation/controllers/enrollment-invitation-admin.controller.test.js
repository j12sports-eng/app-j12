const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentInvitationAdminController,
  readRequestInput,
} = require("./enrollment-invitation-admin.controller.js");
const {
  ENROLLMENT_INVITATION_ADMIN_ERROR_CODES,
} = require("../../application/services/enrollment-invitation-admin-application.service.js");

test("EnrollmentInvitationAdminController returns create and renew responses with rawToken only there", async () => {
  const controller = new EnrollmentInvitationAdminController({
    invitationAdminService: {
      create: async () => result({ rawToken: "A".repeat(43) }),
      getCurrent: async () => result(),
      renew: async () => result({ rawToken: "B".repeat(43) }),
      revoke: async () => ({ changed: true, invitation: result().invitation, status: "REVOKED" }),
    },
  });

  const createRes = createResponse();
  await controller.create(request({ body: { expiresInSeconds: 600 } }), createRes, failNext);
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.data.rawToken, "A".repeat(43));

  const renewRes = createResponse();
  await controller.renew(request({ body: { durationSeconds: 600 } }), renewRes, failNext);
  assert.equal(renewRes.statusCode, 200);
  assert.equal(renewRes.body.data.rawToken, "B".repeat(43));

  const currentRes = createResponse();
  await controller.getCurrent(request(), currentRes, failNext);
  assert.equal(currentRes.statusCode, 200);
  assert.equal(JSON.stringify(currentRes.body).includes("rawToken"), false);
  assert.equal(JSON.stringify(currentRes.body).includes("tokenHash"), false);
});

test("EnrollmentInvitationAdminController rejects invalid input and client unitId", async () => {
  assert.throws(() => readRequestInput(request({ body: { unitId: "13" } }), "create"), {
    code: ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID,
  });
  assert.throws(() => readRequestInput(request({ params: { enrollmentId: "bad id" } }), "create"), {
    code: ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID,
  });
  assert.throws(
    () =>
      readRequestInput(
        request({ body: { durationSeconds: 600, expiresInSeconds: 600 } }),
        "create",
      ),
    { code: ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID },
  );
});

test("EnrollmentInvitationAdminController uses req.actorContext and does not mutate req.auth or req.user", async () => {
  let receivedContext = null;
  const controller = new EnrollmentInvitationAdminController({
    invitationAdminService: {
      create: async (_command, context) => {
        receivedContext = context;
        return result({ rawToken: "A".repeat(43) });
      },
      getCurrent() {},
      renew() {},
      revoke() {},
    },
  });
  const req = request();
  const beforeAuth = JSON.stringify(req.auth);
  const beforeUser = JSON.stringify(req.user);

  await controller.create(req, createResponse(), failNext);

  assert.equal(receivedContext.actorContext, req.actorContext);
  assert.equal(JSON.stringify(req.auth), beforeAuth);
  assert.equal(JSON.stringify(req.user), beforeUser);
});

test("EnrollmentInvitationAdminController maps enumeration-sensitive errors to generic responses", async () => {
  const controller = new EnrollmentInvitationAdminController({
    invitationAdminService: {
      create: async () => {
        const error = new Error("other unit enrollment-1");
        error.code = ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE;
        throw error;
      },
      getCurrent() {},
      renew() {},
      revoke() {},
    },
  });
  const res = createResponse();

  await controller.create(request(), res, failNext);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Enrollment invitation admin operation is unavailable.");
  assert.equal(JSON.stringify(res.body).includes("enrollment-1"), false);
});

function request(overrides = {}) {
  return {
    actorContext: { authIdentityId: "identity-1" },
    auth: { id: "usr-admin", source: "users" },
    body: {},
    params: { enrollmentId: "enrollment-1" },
    query: {},
    user: { id: "usr-admin" },
    ...overrides,
  };
}

function result(overrides = {}) {
  return {
    invitation: {
      createdAt: "2026-07-24 12:00:00",
      enrollmentId: "enrollment-1",
      expiresAt: "2026-07-31 12:00:00",
      id: "invitation-1",
      status: "ACTIVE",
      tokenHash: "hidden",
      unitId: "12",
    },
    ...overrides,
  };
}

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

function failNext(error) {
  throw error || new Error("Unexpected next call.");
}
