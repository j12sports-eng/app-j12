const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_DIGITAL_PUBLIC_ROUTE_BASE_PATH,
  ENROLLMENT_DIGITAL_PUBLIC_ROUTE_PATH,
  createEnrollmentDigitalPublicRouter,
} = require("./enrollment-digital-public.routes.js");

test("GET and PATCH /matricula-digital/:token are public and apply secret-safe headers", async () => {
  const calls = [];
  const router = createEnrollmentDigitalPublicRouter({
    controller: {
      getByToken(_req, res) {
        calls.push("get");
        return res.json({ ok: true });
      },
      patchByToken(_req, res) {
        calls.push("patch");
        return res.json({ saved: true });
      },
    },
  });
  const routes = router.stack.map((layer) => ({
    methods: { ...(layer.route?.methods || {}) },
    path: layer.route?.path,
  }));

  assert.equal(ENROLLMENT_DIGITAL_PUBLIC_ROUTE_BASE_PATH, "/matricula-digital");
  assert.equal(ENROLLMENT_DIGITAL_PUBLIC_ROUTE_PATH, "/:token");
  assert.deepEqual(routes, [
    { methods: { get: true }, path: "/:token" },
    { methods: { patch: true }, path: "/:token" },
  ]);

  const response = await dispatch(router, `/${"A".repeat(43)}`);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
  const patch = await dispatch(router, `/${"A".repeat(43)}`, "PATCH");
  assert.deepEqual(patch.body, { saved: true });
  assert.deepEqual(calls, ["get", "patch"]);
  assert.equal(response.headers["cache-control"], "private, no-store, max-age=0, must-revalidate");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow, noarchive");
});

function dispatch(router, url, method = "GET") {
  const response = createResponse();
  return new Promise((resolve, reject) => {
    const json = response.json.bind(response);
    response.json = (body) => {
      json(body);
      resolve(response);
      return response;
    };
    router.handle({ headers: {}, method, url }, response, (error) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function createResponse() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
