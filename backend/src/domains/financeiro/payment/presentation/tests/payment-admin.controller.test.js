const assert = require("node:assert/strict");
const test = require("node:test");

const { PaymentAdminController } = require("../controllers/payment-admin.controller.js");
const {
  FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH,
  createFinancialPaymentAdminRouter,
} = require("../routes/payment-admin.routes.js");

test("PaymentAdminController delegates charge endpoints to ChargeService", async () => {
  const calls = [];
  const controller = new PaymentAdminController({
    chargeService: {
      async createCharge(input) {
        calls.push(["create", input]);
        return { id: "fgc-created" };
      },
      async deleteCharge(input) {
        calls.push(["delete", input]);
        return { id: input.id, status: "CANCELLED" };
      },
      async getCharge(input) {
        calls.push(["get", input]);
        return { id: input.id };
      },
      async listCharges(input) {
        calls.push(["list", input]);
        return { items: [] };
      },
      async updateCharge(input) {
        calls.push(["update", input]);
        return { id: input.id };
      },
    },
  });

  const createRes = createResponse();
  await controller.createCharge(
    {
      auth: { email: "admin@j12.local" },
      body: {
        amount: 250,
        description: "Mensalidade",
      },
    },
    createRes,
    assertNoNext,
  );
  await controller.listCharges({ query: { provider: "asaas" } }, createResponse(), assertNoNext);
  await controller.getCharge(
    { params: { id: "fgc-1" }, query: {} },
    createResponse(),
    assertNoNext,
  );
  await controller.updateCharge(
    {
      auth: { email: "admin@j12.local" },
      body: { amount: 260 },
      params: { id: "fgc-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.deleteCharge(
    {
      auth: { email: "admin@j12.local" },
      body: { reason: "cancelado" },
      params: { id: "fgc-1" },
    },
    createResponse(),
    assertNoNext,
  );

  assert.equal(createRes.statusCode, 201);
  assert.deepEqual(calls, [
    [
      "create",
      {
        amount: 250,
        description: "Mensalidade",
        requestedBy: "admin@j12.local",
      },
    ],
    ["list", { provider: "asaas" }],
    ["get", { id: "fgc-1" }],
    ["update", { amount: 260, id: "fgc-1", requestedBy: "admin@j12.local" }],
    ["delete", { id: "fgc-1", reason: "cancelado", requestedBy: "admin@j12.local" }],
  ]);
});

test("PaymentAdminRouter registers requested internal charge endpoints", () => {
  const controller = {
    createCharge() {},
    deleteCharge() {},
    getCharge() {},
    listCharges() {},
    updateCharge() {},
  };
  const router = createFinancialPaymentAdminRouter({
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

  assert.equal(FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH, "/admin/financeiro");
  assert.deepEqual(routes, [
    { methods: ["post"], path: "/cobrancas" },
    { methods: ["get"], path: "/cobrancas" },
    { methods: ["get"], path: "/cobrancas/:id" },
    { methods: ["patch"], path: "/cobrancas/:id" },
    { methods: ["delete"], path: "/cobrancas/:id" },
  ]);
  assert.equal(router.stack[0].route, undefined);
  assert.equal(router.stack[1].route, undefined);
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
