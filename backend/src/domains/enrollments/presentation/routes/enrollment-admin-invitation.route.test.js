const assert = require("node:assert/strict");
const test = require("node:test");

const { createEnrollmentAdminRouter } = require("./enrollment-admin.routes.js");

test("POST /:enrollmentId/invitations runs the authenticated canonical admin chain", async () => {
  const order = [];
  const router = createEnrollmentAdminRouter({
    accessMiddleware: mark(order, "access"),
    actorContextMiddleware: mark(order, "actorContext"),
    authMiddleware: mark(order, "auth"),
    controller: handlers({
      createDigitalEnrollmentInvitation(_req, res) {
        order.push("controller");
        res.status(201).json({ success: true });
      },
    }),
  });
  const response = createResponse();
  await handle(
    router,
    { body: {}, headers: {}, method: "POST", url: "/draft-1/invitations" },
    response,
  );
  assert.deepEqual(order, ["auth", "access", "actorContext", "controller"]);
  assert.equal(response.statusCode, 201);
});

function handlers(overrides = {}) {
  return {
    confirmDraft() {},
    createDigitalEnrollmentInvitation() {},
    getCurrentActive() {},
    getCurrentDraft() {},
    getStatus() {},
    openDraft() {},
    searchStudentScopes() {},
    ...overrides,
  };
}

function mark(order, name) {
  return (_req, _res, next) => {
    order.push(name);
    next();
  };
}

function handle(router, req, res) {
  return new Promise((resolve, reject) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      json(body);
      resolve();
      return res;
    };
    router.handle(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
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
