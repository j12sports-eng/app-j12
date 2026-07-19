const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(path, options = {}) {
  const app = express();
  app.use(express.json());
  const routerOptions = {
    authMiddleware: options.skipAuth
      ? undefined
      : (req, _res, next) => {
          req.user = options.user || { id: "admin-1", role: "admin" };
          next();
        },
    conversionHistoryQueryService: { async listConversions() {}, async getConversionById() {} },
    conversionHistoryExportService: { async exportConversions() {} },
    conversionService: { async convertLeadToDraftEnrollment() {} },
    leadRepository: { async findUnitContextById() {} },
    queryService: { async listLeads() {}, async getLeadById() {} },
    stageTimingQueryService: options.stageTimingQueryService || {
      async getLeadStageTiming({ leadId, unitId }) {
        return { leadId, unitId, historyCoverage: "COMPLETE" };
      },
    },
  };
  app.use("/internal/crm", createCrmInternalRouter(routerOptions));
  app.use("/api/internal/crm", createCrmInternalRouter(routerOptions));
  app.use((error, _req, res, _next) =>
    res.status(error.statusCode || 500).json({ code: error.code, success: false }),
  );
  const server = app.listen(0);
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("detail timing and /api alias preserve envelope and unit filter", async () => {
  const internal = await request("/internal/crm/leads/lead-1/stage-timing?unitId=unit-1");
  const alias = await request("/api/internal/crm/leads/lead-1/stage-timing");
  assert.equal(internal.status, 200);
  assert.equal(alias.status, 200);
  assert.deepEqual((await internal.json()).data, {
    leadId: "lead-1",
    unitId: "unit-1",
    historyCoverage: "COMPLETE",
  });
});

test("authentication and authorization remain mandatory", async () => {
  assert.equal(
    (await request("/internal/crm/leads/lead-1/stage-timing", { skipAuth: true })).status,
    401,
  );
  const denied = await request("/internal/crm/leads/lead-1/stage-timing", {
    user: { id: "student", role: "aluno" },
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "CRM_ACCESS_DENIED");
});

test("invalid params and unknown filters return deterministic 400", async () => {
  assert.equal((await request("/internal/crm/leads/bad%20id/stage-timing")).status, 400);
  assert.equal((await request("/internal/crm/leads/lead-1/stage-timing?sla=1")).status, 400);
});

test("missing lead remains a sanitized 404", async () => {
  const response = await request("/internal/crm/leads/missing/stage-timing", {
    stageTimingQueryService: {
      async getLeadStageTiming() {
        throw Object.assign(new Error("not found"), {
          code: "CRM_LEAD_NOT_FOUND",
          statusCode: 404,
        });
      },
    },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "CRM_LEAD_NOT_FOUND");
});
