const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");
const { createEnrollmentAdminRouter } = require("./enrollment-admin.routes.js");

test("official invitation endpoint integrates ActorContext, facade, services and repositories", async () => {
  const invitationRepository = new MemoryEnrollmentDigitalInvitationRepository();
  const actorContext = {
    authIdentityId: "identity-1",
    correlationId: "correlation-1",
    membershipRole: "admin",
    requestId: "request-1",
    unitContext: { membershipRole: "admin", unitId: "12" },
  };
  const tokens = ["A".repeat(43), "B".repeat(43)];
  let tokenIndex = 0;
  const router = createEnrollmentAdminRouter({
    accessMiddleware: (_req, _res, next) => next(),
    actorContextMiddleware(req, _res, next) {
      req.actorContext = actorContext;
      next();
    },
    authMiddleware: (_req, _res, next) => next(),
    enrollmentRepository: new EnrollmentReaderRepository(),
    invitationClock: () => new Date("2026-07-29T12:00:00.000Z"),
    invitationRepository,
    invitationTokenGenerator: () => tokens[tokenIndex++],
  });

  const first = await dispatch(router, { body: {}, url: "/draft-1/invitations" });
  const second = await dispatch(router, { body: {}, url: "/draft-1/invitations" });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.notEqual(first.body.data.invitationId, second.body.data.invitationId);
  assert.notEqual(first.body.data.url, second.body.data.url);
  assert.deepEqual(Object.keys(first.body.data), ["expiresAt", "invitationId", "status", "url"]);
  assert.equal(JSON.stringify(first.body).includes("tokenHash"), false);
  assert.equal(JSON.stringify(first.body).includes("unitId"), false);
  assert.equal(
    [...invitationRepository.rows.values()].filter((row) => row.status === "ACTIVE").length,
    1,
  );
});

class EnrollmentReaderRepository {
  async create() {
    throw new Error("write bypass must not be used");
  }
  async findById(id) {
    return id === "draft-1" ? { id, status: "DRAFT", unitId: "12" } : null;
  }
}

async function dispatch(router, { body, url }) {
  const response = createResponse();
  await new Promise((resolve, reject) => {
    const json = response.json.bind(response);
    response.json = (payload) => {
      json(payload);
      resolve();
      return response;
    };
    router.handle(
      { body, headers: { "x-unit-id": "999" }, method: "POST", query: { unitId: "998" }, url },
      response,
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
  return response;
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader() {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
