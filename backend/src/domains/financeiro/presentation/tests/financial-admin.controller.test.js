const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FinancialAdminController,
} = require("../controllers/financial-admin.controller.js");
const {
  FINANCIAL_ADMIN_ROUTE_BASE_PATH,
  createFinancialAdminRouter,
} = require("../routes/financial-admin.routes.js");

test("FinancialAdminController delegates admin operations only to FinancialFacade", async () => {
  const calls = [];
  const controller = new FinancialAdminController({
    financialFacade: {
      async cancelEnrollmentFinancialObligation(input) {
        calls.push(["cancel", input]);
        return { cancelled: true };
      },
      async getStudentFinancialSummary(input) {
        calls.push(["summary", input]);
        return { summary: true };
      },
      async listEnrollmentFinancialObligations(input) {
        calls.push(["list", input]);
        return { obligations: [] };
      },
      async searchFinancialStudentScopes(input) {
        calls.push(["search", input]);
        return { scopes: [] };
      },
      async markEnrollmentFinancialObligationAsOverdue(input) {
        calls.push(["overdue", input]);
        return { overdue: true };
      },
      async markEnrollmentFinancialObligationAsPaid(input) {
        calls.push(["paid", input]);
        return { paid: true };
      },
    },
  });

  await controller.listEnrollmentObligations(
    { params: { enrollmentId: "enrollment-admin" }, query: {} },
    createResponse(),
    assertNoNext,
  );
  await controller.getStudentSummary(
    {
      params: {
        studentPersonId: "person-admin",
        studentProfileId: "profile-admin",
      },
      query: {},
    },
    createResponse(),
    assertNoNext,
  );
  await controller.searchStudentScopes(
    {
      query: {
        limit: "5",
        q: "Joao",
      },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.markPaid(
    {
      auth: { email: "admin@j12.local", role: "admin" },
      body: {
        paidAt: "2026-07-20 10:00:00",
        paymentReference: "manual-1",
      },
      params: { obligationId: "obligation-paid" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.cancel(
    {
      auth: { email: "admin@j12.local", role: "admin" },
      body: {
        cancelledAt: "2026-07-21 10:00:00",
        reason: "manual-cancel",
      },
      params: { obligationId: "obligation-cancel" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.markOverdue(
    {
      body: { checkedAt: "2026-07-22 10:00:00" },
      params: { obligationId: "obligation-overdue" },
    },
    createResponse(),
    assertNoNext,
  );

  assert.deepEqual(calls, [
    ["list", { enrollmentId: "enrollment-admin", limit: 50 }],
    [
      "summary",
      {
        limit: 50,
        studentPersonId: "person-admin",
        studentProfileId: "profile-admin",
      },
    ],
    [
      "search",
      {
        limit: 5,
        query: "Joao",
      },
    ],
    [
      "paid",
      {
        obligationId: "obligation-paid",
        paidAt: "2026-07-20 10:00:00",
        paidBy: "admin@j12.local",
        paymentReference: "manual-1",
      },
    ],
    [
      "cancel",
      {
        cancelledAt: "2026-07-21 10:00:00",
        cancelledBy: "admin@j12.local",
        obligationId: "obligation-cancel",
        reason: "manual-cancel",
      },
    ],
    [
      "overdue",
      {
        checkedAt: "2026-07-22 10:00:00",
        obligationId: "obligation-overdue",
      },
    ],
  ]);
});

test("FinancialAdminRouter registers secured administrative endpoints", () => {
  const controller = {
    cancel() {},
    getStudentSummary() {},
    listEnrollmentObligations() {},
    markOverdue() {},
    markPaid() {},
    searchStudentScopes() {},
  };
  const router = createFinancialAdminRouter({
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

  assert.equal(FINANCIAL_ADMIN_ROUTE_BASE_PATH, "/admin/financial");
  assert.deepEqual(routes, [
    { methods: ["get"], path: "/enrollments/:enrollmentId/obligations" },
    { methods: ["get"], path: "/students/search" },
    { methods: ["get"], path: "/students/:studentPersonId/:studentProfileId/summary" },
    { methods: ["post"], path: "/obligations/:obligationId/mark-paid" },
    { methods: ["post"], path: "/obligations/:obligationId/cancel" },
    { methods: ["post"], path: "/obligations/:obligationId/mark-overdue" },
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
