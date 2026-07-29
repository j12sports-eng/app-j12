const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createEnrollmentAdminRouter } = require("./enrollment-admin.routes.js");
const { createEnrollmentPublicRouter } = require("./enrollment-public.routes.js");

const ROUTERS = [
  ["admin", createEnrollmentAdminRouter],
  ["secured public", createEnrollmentPublicRouter],
];

for (const [name, createRouter] of ROUTERS) {
  test(`${name} Enrollment router attaches canonical ActorContext before controller`, async () => {
    const order = [];
    const actorContext = Object.freeze({
      authIdentityId: "identity-1",
      unitContext: Object.freeze({ unitId: "12" }),
    });
    const router = createRouter({
      accessMiddleware: mark(order, "access"),
      actorContextMiddleware(req, _res, next) {
        order.push("actorContext");
        req.actorContext = actorContext;
        next();
      },
      authMiddleware: mark(order, "requireAuth"),
      controller: controller(order, actorContext),
    });
    const res = createResponse();

    await handle(router, request(), res);

    assert.deepEqual(order, ["requireAuth", "access", "actorContext", "controller"]);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
  });

  test(`${name} Enrollment router never executes controller when context resolution fails`, async () => {
    let controllerCalls = 0;
    const expected = Object.assign(new Error("safe context failure"), {
      code: "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE",
      statusCode: 403,
    });
    const router = createRouter({
      accessMiddleware: (_req, _res, next) => next(),
      actorContextMiddleware: (_req, _res, next) => next(expected),
      authMiddleware: (_req, _res, next) => next(),
      controller: {
        confirmDraft() {},
        getCurrentActive() {},
        getCurrentDraft() {},
        openDraft() {},
        getStatus() {
          controllerCalls += 1;
        },
        searchStudentScopes() {},
      },
    });

    await assert.rejects(() => handle(router, request(), createResponse()), {
      code: expected.code,
      statusCode: 403,
    });
    assert.equal(controllerCalls, 0);
  });
}

test("public invitation router stays independent from authenticated ActorContext composition", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "enrollment-invitation-public.routes.js"),
    "utf8",
  );

  assert.equal(source.includes("actorContext"), false);
  assert.equal(source.includes("createEnrollmentRouteContextComposition"), false);
  assert.equal(source.includes("createEnrollmentActorContextMiddleware"), false);
});

test("mounted Enrollment route factories opt into the canonical route context composition", () => {
  const root = path.resolve(__dirname, "../../../../..");
  const server = fs.readFileSync(path.join(root, "src", "server.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "enrollment-admin.routes.js"), "utf8");
  const securedPublic = fs.readFileSync(
    path.join(__dirname, "enrollment-public.routes.js"),
    "utf8",
  );

  assert.match(server, /createEnrollmentAdminRouter\(\)/u);
  assert.match(server, /createEnrollmentPublicRouter\(\)/u);
  assert.match(admin, /createEnrollmentActorContextMiddleware\(options\)/u);
  assert.match(securedPublic, /createEnrollmentActorContextMiddleware\(options\)/u);
  assert.doesNotMatch(server, /x-unit-id/iu);
  assert.doesNotMatch(server, /X-Unit-Id/u);
});

function controller(order, expectedActorContext) {
  return {
    confirmDraft() {},
    getCurrentActive() {},
    getCurrentDraft() {},
    openDraft() {},
    getStatus(req, res) {
      order.push("controller");
      assert.equal(req.actorContext, expectedActorContext);
      res.status(200).json({ success: true });
    },
    searchStudentScopes() {},
  };
}

function mark(order, name) {
  return (_req, _res, next) => {
    order.push(name);
    next();
  };
}

function request() {
  return {
    body: { unitId: "999" },
    headers: { "x-unit-id": "999" },
    method: "GET",
    params: { unitId: "999" },
    query: { unitId: "999" },
    url: "/status",
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
