const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(path, options = {}) {
  const app = express();
  const order = [];
  app.use(express.json());
  const routerOptions = {
    authMiddleware: options.skipAuth
      ? undefined
      : (req, _res, next) => {
          order.push("auth");
          req.auth = options.user || { id: "admin-1", role: "admin" };
          req.user = req.auth;
          req.correlationId = "corr-1";
          next();
        },
    accessMiddleware: options.skipAuth
      ? undefined
      : options.accessMiddleware ||
        ((req, res, next) => {
          order.push("access");
          if (!["admin", "coordenador"].includes(req.user?.role)) {
            return res.status(403).json({ code: "CRM_ACCESS_DENIED", success: false });
          }
          next();
        }),
    conversionHistoryExportService: { async exportConversions() {} },
    conversionHistoryQueryService: { async getConversionById() {}, async listConversions() {} },
    conversionService: { async convertLeadToDraftEnrollment() {} },
    leadRepository: { async findUnitContextById() {} },
    queryService: { async getLeadById() {}, async listLeads() {} },
    slaAlertQueryService: options.slaAlertQueryService || {
      async listSlaAlerts(filters, context) {
        order.push("controller");
        return {
          appliedFilters: filters,
          context,
          hasMore: false,
          items: [],
          nextCursor: null,
          summary: {
            pageCounts: {
              completed: 0,
              normal: 0,
              notConfigured: 0,
              overdue: 0,
              unavailable: 0,
              warning: 0,
            },
          },
        };
      },
    },
    stageTimingQueryService: { async getLeadStageTiming() {} },
  };
  if (options.useRealAlertService) delete routerOptions.slaAlertQueryService;
  const router = createCrmInternalRouter(routerOptions);
  app.use("/internal/crm", router);
  app.use("/api/internal/crm", router);
  app.use((error, _req, res, _next) =>
    res.status(error.statusCode || 500).json({
      code: error.code || "INTERNAL_ERROR",
      message: error.statusCode >= 500 ? "CRM SLA alert query failed." : error.message,
      success: false,
    }),
  );
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    return { order, response };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("protected internal endpoint and /api alias preserve middleware order and envelope", async () => {
  const internal = await request("/internal/crm/sla-alerts?stage=NEW&limit=25");
  const alias = await request("/api/internal/crm/sla-alerts?slaStatus=NOT_CONFIGURED");
  assert.equal(internal.response.status, 200);
  assert.equal(alias.response.status, 200);
  assert.deepEqual(internal.order, ["auth", "access", "controller"]);
  assert.deepEqual(alias.order, ["auth", "access", "controller"]);
  const payload = await internal.response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.appliedFilters.stage, "NEW");
});

test("authentication and authorization are mandatory and no public route is created", async () => {
  assert.equal(
    (await request("/internal/crm/sla-alerts", { skipAuth: true })).response.status,
    401,
  );
  const denied = await request("/internal/crm/sla-alerts", {
    user: { id: "student-1", role: "aluno" },
  });
  assert.equal(denied.response.status, 403);
  assert.equal((await denied.response.json()).code, "CRM_ACCESS_DENIED");

  const app = express();
  app.use(
    "/internal/crm",
    createCrmInternalRouter({
      authMiddleware: (_req, _res, next) => next(),
      accessMiddleware: (_req, _res, next) => next(),
      conversionHistoryExportService: { async exportConversions() {} },
      conversionHistoryQueryService: { async getConversionById() {}, async listConversions() {} },
      conversionService: { async convertLeadToDraftEnrollment() {} },
      leadRepository: { async findUnitContextById() {} },
      queryService: { async getLeadById() {}, async listLeads() {} },
      slaAlertQueryService: { async listSlaAlerts() {} },
      stageTimingQueryService: { async getLeadStageTiming() {} },
    }),
  );
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sla-alerts`);
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unknown fields, arrays, excessive limit and invalid cursor return deterministic 400", async () => {
  for (const path of [
    "/internal/crm/sla-alerts?search=x",
    "/internal/crm/sla-alerts?responsibleId=operator-1",
    "/internal/crm/sla-alerts?stage=NEW&stage=WON",
    "/internal/crm/sla-alerts?limit=101",
    "/internal/crm/sla-alerts?cursor=invalid",
  ]) {
    const response = (await request(path, { useRealAlertService: true })).response;
    assert.equal(response.status, 400, path);
  }
});

test("service failure returns sanitized 500 without infrastructure details", async () => {
  const result = await request("/internal/crm/sla-alerts", {
    slaAlertQueryService: {
      async listSlaAlerts() {
        throw Object.assign(new Error("SQL CPF 52998224725"), {
          code: "CRM_SLA_ALERT_QUERY_FAILED",
          statusCode: 500,
        });
      },
    },
  });
  assert.equal(result.response.status, 500);
  const payload = await result.response.json();
  assert.equal(payload.code, "CRM_SLA_ALERT_QUERY_FAILED");
  assert.equal(JSON.stringify(payload).includes("52998224725"), false);
});
