const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { BiFoundationController } = require("../controllers/bi-foundation.controller.js");
const {
  BI_ADMIN_ROUTE_BASE_PATH,
  createBiAdminRouter,
  ensureBiAdminAccess,
} = require("../routes/bi-admin.routes.js");

test("BI controller delegates to the foundation service", async () => {
  const calls = [];
  const controller = new BiFoundationController({
    service: {
      describe(query) {
        calls.push(query);
        return { contractVersion: "21.1" };
      },
    },
  });
  const res = response();
  await controller.describe({ query: { period: "TODAY" } }, res, noNext);
  assert.deepEqual(calls, [{ period: "TODAY" }]);
  assert.deepEqual(res.body, { data: { contractVersion: "21.1" }, success: true });
});

test("BI controller handles filters and forwards unexpected errors", async () => {
  const invalidController = new BiFoundationController({
    service: {
      describe() {
        throw Object.assign(new Error("invalid"), {
          code: "BI_FILTER_INVALID",
          details: { field: "unitId" },
        });
      },
    },
  });
  const res = response();
  await invalidController.describe({ query: {} }, res, noNext);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "BI_FILTER_INVALID");

  const unexpected = new Error("unexpected");
  const forwardingController = new BiFoundationController({
    service: {
      describe() {
        throw unexpected;
      },
    },
  });
  let forwarded = null;
  await forwardingController.describe({ query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded, unexpected);
});

test("BI router preserves foundation and exposes the protected executive endpoint", () => {
  const router = createBiAdminRouter({ authMiddleware: pass, accessMiddleware: pass });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      methods: Object.keys(layer.route.methods),
      path: layer.route.path,
    }));
  assert.equal(BI_ADMIN_ROUTE_BASE_PATH, "/admin/bi");
  assert.deepEqual(routes, [
    { methods: ["get"], path: "/foundation" },
    { methods: ["get"], path: "/executive" },
    { methods: ["get"], path: "/financial" },
    { methods: ["get"], path: "/students" },
    { methods: ["get"], path: "/classes" },
  ]);
  assert.equal(router.stack.filter((layer) => !layer.route).length, 2);
});

test("BI endpoint rejects unauthenticated and unauthorized access", () => {
  const unauthenticated = response();
  const auth = (_req, res) => res.status(401).json({ success: false });
  const authRouter = createBiAdminRouter({ authMiddleware: auth, accessMiddleware: pass });
  authRouter.stack[0].handle({}, unauthenticated, noNext);
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = response();
  ensureBiAdminAccess({ auth: { role: "aluno" } }, forbidden, noNext);
  assert.equal(forbidden.statusCode, 403);
});

test("BI authorized endpoint returns foundation metadata and server mounts it once", async () => {
  const router = createBiAdminRouter({ authMiddleware: pass, accessMiddleware: pass });
  const routeLayer = router.stack.find((layer) => layer.route?.path === "/foundation");
  const res = response();
  await routeLayer.route.stack[0].handle({ query: { period: "TODAY" } }, res, noNext);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.contractVersion, "21.1");
  assert.equal(res.body.data.timezone, "America/Sao_Paulo");

  const serverSource = await readFile(path.resolve(__dirname, "../../../../server.js"), "utf8");
  assert.match(serverSource, /const biAdminRoutes = createBiAdminRouter\(\)/);
  assert.match(
    serverSource,
    /mount\(\[BI_ADMIN_ROUTE_BASE_PATH, `\/api\$\{BI_ADMIN_ROUTE_BASE_PATH\}`\], biAdminRoutes\)/,
  );
});

function pass(_req, _res, next) {
  next();
}
function noNext(error) {
  if (error) throw error;
}
function response() {
  return {
    body: null,
    statusCode: 200,
    json(value) {
      this.body = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
  };
}
