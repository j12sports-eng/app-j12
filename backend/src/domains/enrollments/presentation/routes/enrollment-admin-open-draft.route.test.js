const assert = require("node:assert/strict");
const test = require("node:test");

const { createEnrollmentAdminRouter } = require("./enrollment-admin.routes.js");

test("POST / is mounted only on the authenticated administrative router after ActorContext", async () => {
  const order = [];
  const actorContext = Object.freeze({ unitContext: Object.freeze({ unitId: "12" }) });
  const controller = handlers({
    openDraft(req, res) {
      order.push("controller");
      assert.equal(req.actorContext, actorContext);
      res.status(201).json({ success: true });
    },
  });
  const router = createEnrollmentAdminRouter({
    accessMiddleware: mark(order, "access"),
    actorContextMiddleware(req, _res, next) {
      order.push("actorContext");
      req.actorContext = actorContext;
      next();
    },
    authMiddleware: mark(order, "auth"),
    controller,
  });
  const response = createResponse();

  await handle(router, { body: {}, headers: {}, method: "POST", url: "/" }, response);

  assert.deepEqual(order, ["auth", "access", "actorContext", "controller"]);
  assert.equal(response.statusCode, 201);
});

function handlers(overrides = {}) {
  return {
    confirmDraft() {},
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
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      originalJson(body);
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
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    setHeader() {},
  };
}
