const assert = require("node:assert/strict");
const test = require("node:test");

const { InterAdminController } = require("../controllers/inter-admin.controller.js");
const {
  FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH,
  createFinancialInterAdminRouter,
} = require("../routes/inter-admin.routes.js");

test("InterAdminController delegates Banco Inter operations to service", async () => {
  const calls = [];
  const controller = new InterAdminController({
    interService: {
      async consultarCobranca(input) {
        calls.push(["get", input]);
        return { ok: true };
      },
      async emitirCobranca(input) {
        calls.push(["create", input]);
        return { created: true };
      },
      async createPix(input) {
        calls.push(["pix", input]);
        return { pix: true };
      },
      async cancelPix(input) {
        calls.push(["cancelPix", input]);
        return { cancelled: true };
      },
      async getPix(input) {
        calls.push(["getPix", input]);
        return { pix: true };
      },
      async processarWebhook(input) {
        calls.push(["webhook", input]);
        return { processed: true };
      },
      async sincronizar(input) {
        calls.push(["sync", input]);
        return { synced: true };
      },
    },
  });

  await controller.createCharge(
    {
      auth: { email: "admin@j12.local" },
      body: { cobrancaId: "cob-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.getCharge(
    {
      params: { id: "cob-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.sync(
    {
      body: { limit: 5 },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.webhook(
    {
      body: { pix: [{ txid: "TXID" }] },
      headers: { "x-inter-token": "secret" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.createPix(
    {
      auth: { email: "admin@j12.local" },
      body: { cobrancaId: "cob-pix" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.getPix(
    {
      params: { txid: "TXID-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.cancelPix(
    {
      auth: { email: "admin@j12.local" },
      body: { reason: "cancel" },
      params: { txid: "TXID-1" },
    },
    createResponse(),
    assertNoNext,
  );

  assert.deepEqual(calls, [
    ["create", { cobrancaId: "cob-1", requestedBy: "admin@j12.local" }],
    ["get", { id: "cob-1" }],
    ["sync", { limit: 5 }],
    ["webhook", { body: { pix: [{ txid: "TXID" }] }, headers: { "x-inter-token": "secret" } }],
    ["pix", { cobrancaId: "cob-pix", requestedBy: "admin@j12.local" }],
    ["getPix", { txid: "TXID-1" }],
    ["cancelPix", { reason: "cancel", requestedBy: "admin@j12.local", txid: "TXID-1" }],
  ]);
});

test("InterAdminRouter registers requested internal endpoints with webhook before auth", () => {
  const controller = {
    cancelPix() {},
    createCharge() {},
    createPix() {},
    getCharge() {},
    getPix() {},
    sync() {},
    webhook() {},
  };
  const router = createFinancialInterAdminRouter({
    accessMiddleware(_req, _res, next) {
      next();
    },
    authMiddleware(_req, _res, next) {
      next();
    },
    controller,
  });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      methods: Object.keys(layer.route.methods).sort(),
      path: layer.route.path,
    }));

  assert.equal(FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH, "/admin/financeiro/inter");
  assert.deepEqual(routes, [
    { methods: ["post"], path: "/webhook" },
    { methods: ["post"], path: "/pix" },
    { methods: ["get"], path: "/pix/:txid" },
    { methods: ["delete"], path: "/pix/:txid" },
    { methods: ["post"], path: "/cobrancas" },
    { methods: ["get"], path: "/cobrancas/:id" },
    { methods: ["post"], path: "/sincronizar" },
  ]);
  assert.equal(router.stack[1].route, undefined);
  assert.equal(router.stack[2].route, undefined);
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

function assertNoNext(error) {
  if (error) {
    throw error;
  }
}
