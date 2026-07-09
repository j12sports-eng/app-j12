const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FinancialAutomationController,
} = require("../controllers/financial-automation.controller.js");
const {
  createAutomationOriginGuard,
  createAutomationRateLimit,
  createAutomationServiceAuth,
  createFinancialAutomationRouter,
} = require("../routes/financial-automation.routes.js");

test("FinancialAutomationRouter registers n8n automation endpoints", () => {
  const router = createFinancialAutomationRouter({
    controller: {
      listOverdue() {},
      listPayments() {},
      listUpcoming() {},
      process() {},
      recordEvent() {},
    },
    rateLimitDisabled: true,
    serviceToken: "secret",
  });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      methods: Object.keys(layer.route.methods),
      path: layer.route.path,
    }));

  assert.deepEqual(routes, [
    { methods: ["get"], path: "/vencimentos" },
    { methods: ["get"], path: "/inadimplentes" },
    { methods: ["get"], path: "/pagamentos" },
    { methods: ["post"], path: "/eventos" },
    { methods: ["post"], path: "/processar" },
  ]);
});

test("FinancialAutomation service auth accepts configured service token", () => {
  const middleware = createAutomationServiceAuth({
    logger: silentLogger(),
    serviceToken: "secret",
  });
  const req = mockReq({
    authorization: "Bearer secret",
  });
  const res = mockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("FinancialAutomation service auth rejects invalid token without logging sensitive data", () => {
  const warnings = [];
  const middleware = createAutomationServiceAuth({
    logger: { warn: (message, meta) => warnings.push({ message, meta }) },
    serviceToken: "secret",
  });
  const req = mockReq({
    authorization: "Bearer wrong",
  });
  const res = mockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "FINANCIAL_AUTOMATION_UNAUTHORIZED");
  assert.equal(JSON.stringify(warnings).includes("wrong"), false);
});

test("FinancialAutomation origin guard rejects origins outside allowlist", () => {
  const middleware = createAutomationOriginGuard({
    allowedOrigins: ["https://n8n.j12.test"],
    logger: silentLogger(),
  });
  const req = mockReq({ origin: "https://bad.test" });
  const res = mockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "FINANCIAL_AUTOMATION_ORIGIN_FORBIDDEN");
});

test("FinancialAutomation rate limit blocks excessive automation calls", () => {
  const store = new Map();
  const middleware = createAutomationRateLimit({
    rateLimitMax: 1,
    rateLimitStore: store,
    rateLimitWindowMs: 60_000,
  });
  const first = mockRes();
  const second = mockRes();
  let firstNext = false;
  let secondNext = false;

  middleware(mockReq(), first, () => {
    firstNext = true;
  });
  middleware(mockReq(), second, () => {
    secondNext = true;
  });

  assert.equal(firstNext, true);
  assert.equal(secondNext, false);
  assert.equal(second.statusCode, 429);
});

test("FinancialAutomationController records events through service", async () => {
  const controller = new FinancialAutomationController({
    service: {
      async listUpcomingInstallments() {
        return {};
      },
      async recordEvent(input) {
        assert.equal(input.requestedBy, "workflow-financeiro");
        return {
          created: true,
          event: { id: "evt-1" },
        };
      },
    },
  });
  const res = mockRes();

  await controller.recordEvent(
    {
      body: {
        eventType: "LEMBRETE_ENVIADO",
        targetId: "men-1",
        targetType: "MENSALIDADE",
      },
      headers: {
        "x-service-name": "workflow-financeiro",
      },
    },
    res,
    assert.ifError,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.event.id, "evt-1");
});

function mockReq(headers = {}) {
  return {
    headers,
    id: "req-1",
    ip: "127.0.0.1",
    method: "GET",
    originalUrl: "/api/admin/financeiro/automation/vencimentos",
    path: "/vencimentos",
    socket: {
      remoteAddress: "127.0.0.1",
    },
  };
}

function mockRes() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

function silentLogger() {
  return {
    warn() {},
  };
}
