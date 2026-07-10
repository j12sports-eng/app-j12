const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FinancialAutomationHistoryController,
} = require("../controllers/financial-automation-history.controller.js");
const {
  FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH,
  createFinancialAutomationHistoryRouter,
} = require("../routes/financial-automation-history.routes.js");

test("history controller paginates with a real total and sanitizes nested output", async () => {
  const controller = new FinancialAutomationHistoryController({
    historyService: {
      listHistory: async () => [
        {
          toJSON: () => ({
            id: "h1",
            token: "secret",
            senha: "hidden",
            certificados: ["hidden"],
            nested: { password: "hidden", safe: true },
          }),
        },
      ],
      countHistory: async () => 51,
    },
  });
  const response = mockResponse();
  await controller.list({ query: { page: "2", limit: "50", sortBy: "startedAt" } }, response);
  assert.equal(response.body.data.pagination.total, 51);
  assert.equal(response.body.data.pagination.hasPrevious, true);
  assert.equal(response.body.data.pagination.hasNext, false);
  assert.deepEqual(response.body.data.items[0], { id: "h1", nested: { safe: true } });
});

test("history controller maps page to offset, forwards every filter and validates limits", async () => {
  let listFilters;
  const controller = new FinancialAutomationHistoryController({
    historyService: {
      listHistory: async (filters) => {
        listFilters = filters;
        return [];
      },
      countHistory: async () => 0,
    },
  });
  const response = mockResponse();
  await controller.list(
    {
      query: {
        page: "3",
        limit: "25",
        automationName: "billing",
        workflowName: "workflow",
        status: "FAILED",
        correlationId: "corr",
        executionId: "exec",
        triggerType: "manual",
        startedFrom: "2026-07-01",
        startedTo: "2026-07-31",
        sortBy: "durationMs",
        sortDirection: "asc",
      },
    },
    response,
  );
  assert.deepEqual(listFilters, {
    automationName: "billing",
    workflowName: "workflow",
    status: "FAILED",
    correlationId: "corr",
    executionId: "exec",
    triggerType: "manual",
    startedFrom: "2026-07-01",
    startedTo: "2026-07-31",
    sortBy: "durationMs",
    sortDirection: "asc",
    limit: 25,
    offset: 50,
  });
  const invalid = mockResponse();
  await controller.list({ query: { page: "0", limit: "1001" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("history controller returns 404 and controlled invalid input", async () => {
  const controller = new FinancialAutomationHistoryController({
    historyService: { findById: async () => null },
  });
  const missing = mockResponse();
  await controller.getById({ params: { historyId: "missing" } }, missing);
  assert.equal(missing.statusCode, 404);
  const invalid = mockResponse();
  await controller.getById({ params: { historyId: "" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("execution endpoint returns every append-only event in chronological order", async () => {
  let received;
  const controller = new FinancialAutomationHistoryController({
    historyService: {
      listByExecutionId: async (...args) => {
        received = args;
        return [{ toJSON: () => ({ id: "started" }) }, { toJSON: () => ({ id: "done" }) }];
      },
    },
  });
  const response = mockResponse();
  await controller.getByExecutionId({ params: { executionId: "exec-1" } }, response);
  assert.deepEqual(received, [
    "exec-1",
    { limit: 1000, sortBy: "startedAt", sortDirection: "asc" },
  ]);
  assert.equal(response.body.data.items.length, 2);
});

test("history router protects access and registers execution before generic id", () => {
  assert.equal(
    FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH,
    "/admin/financeiro/automacoes/historico",
  );
  const pass = (_req, _res, next) => next();
  const router = createFinancialAutomationHistoryRouter({
    authMiddleware: pass,
    accessMiddleware: pass,
    controller: { list: pass, getById: pass, getByExecutionId: pass },
  });
  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.deepEqual(paths, ["/", "/execution/:executionId", "/:historyId"]);
});

test("history router keeps authentication and authorization before handlers", () => {
  const unauthorized = (_req, res) => res.status(401).json({ success: false });
  const forbidden = (_req, res) => res.status(403).json({ success: false });
  const controller = { list() {}, getById() {}, getByExecutionId() {} };
  const authRouter = createFinancialAutomationHistoryRouter({
    authMiddleware: unauthorized,
    accessMiddleware: forbidden,
    controller,
  });
  const unauthenticated = mockResponse();
  authRouter.stack[0].handle({}, unauthenticated, () => {});
  assert.equal(unauthenticated.statusCode, 401);
  const forbiddenResponse = mockResponse();
  authRouter.stack[1].handle({}, forbiddenResponse, () => {});
  assert.equal(forbiddenResponse.statusCode, 403);
});

test("composition root exports and mounts the history router once with optional api prefix", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const server = fs.readFileSync(path.resolve(__dirname, "../../../../server.js"), "utf8");
  assert.match(server, /createFinancialAutomationHistoryRouter/);
  assert.match(server, /`\/api\$\{FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH\}`/);
  assert.equal((server.match(/financialAutomationHistoryRoutes\s*=\s*create/g) || []).length, 1);
});

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
