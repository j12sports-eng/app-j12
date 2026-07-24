const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createEnrollmentInvitationAdminRouter,
} = require("./enrollment-invitation-admin.routes.js");

test("Enrollment invitation admin router applies auth, UnitContext, ActorContext, guard and controller in order", async () => {
  const order = [];
  const router = createEnrollmentInvitationAdminRouter({
    actorContextMiddleware: mark(order, "actorContext"),
    authMiddleware: mark(order, "requireAuth"),
    controller: {
      create: (req, res) => {
        order.push("controller");
        res.status(201).json({ success: true });
      },
      getCurrent() {},
      renew() {},
      revoke() {},
    },
    roleGuardFactory: (action) => mark(order, `guard:${action}`),
    unitContextMiddleware: mark(order, "unitContext"),
  });
  const res = createResponse();

  await handle(router, { method: "POST", url: "/enrollment-1/digital-invitations" }, res);

  assert.deepEqual(order, [
    "requireAuth",
    "unitContext",
    "actorContext",
    "guard:CREATE_INVITATION",
    "controller",
  ]);
  assert.equal(res.statusCode, 201);
});

test("Enrollment invitation admin router requires context middleware dependencies", () => {
  assert.throws(() => createEnrollmentInvitationAdminRouter(), /unitContextMiddleware/i);
  assert.throws(
    () =>
      createEnrollmentInvitationAdminRouter({
        unitContextMiddleware() {},
      }),
    /actorContextMiddleware/i,
  );
});

test("Enrollment invitation admin routes are not mounted in server or legacy public routes", () => {
  const root = path.resolve(__dirname, "../../../../..");
  const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const publicRoutes = fs.readFileSync(path.join(__dirname, "enrollment-public.routes.js"), "utf8");

  assert.equal(serverSource.includes("createEnrollmentInvitationAdminRouter"), false);
  assert.equal(serverSource.includes("digital-invitations"), false);
  assert.equal(publicRoutes.includes("digital-invitations"), false);
});

function mark(order, name) {
  return (_req, _res, next) => {
    order.push(name);
    next();
  };
}

function handle(router, req, res) {
  req.headers ||= {};
  return new Promise((resolve, reject) => {
    const originalJson = res.json.bind(res);
    const originalEnd = typeof res.end === "function" ? res.end.bind(res) : null;
    res.json = (body) => {
      originalJson(body);
      resolve();
      return res;
    };
    if (originalEnd) {
      res.end = (...args) => {
        originalEnd(...args);
        resolve();
        return res;
      };
    }
    router.handle(req, res, (error) => {
      if (error) reject(error);
    });
  });
}

function createResponse() {
  return {
    body: null,
    end() {
      return this;
    },
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
