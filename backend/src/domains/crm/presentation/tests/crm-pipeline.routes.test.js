const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(path, options = {}) {
  const app = express();
  const routerOptions = {
    authMiddleware: options.skipAuth
      ? undefined
      : (req, _res, next) => {
          req.user = options.user || { id: "admin-1", role: "admin" };
          next();
        },
    pipelineService: options.pipelineService || {
      getPipeline() {
        return { cardFields: [], stages: [{ id: "NEW" }], transitions: [] };
      },
    },
    conversionHistoryExportService: { async export() {} },
    conversionHistoryQueryService: {
      async listConversions() {},
      async getConversionById() {},
    },
    conversionService: { async convertLeadToDraftEnrollment() {} },
    leadRepository: { async findUnitContextById() {} },
    queryService: { async listLeads() {}, async getLeadById() {} },
  };
  app.use("/internal/crm", createCrmInternalRouter(routerOptions));
  app.use("/api/internal/crm", createCrmInternalRouter(routerOptions));
  app.use((error, _req, res, _next) =>
    res.status(error.statusCode || 500).json({ code: error.code, success: false }),
  );
  const server = app.listen(0);
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: options.method || "GET",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("pipeline is available through both protected aliases", async () => {
  const internal = await request("/internal/crm/pipeline");
  const api = await request("/api/internal/crm/pipeline");
  assert.equal(internal.status, 200);
  assert.equal(api.status, 200);
  assert.equal((await internal.json()).data.stages[0].id, "NEW");
});

test("pipeline preserves authentication, authorization and read-only method", async () => {
  assert.equal((await request("/internal/crm/pipeline", { skipAuth: true })).status, 401);
  const denied = await request("/internal/crm/pipeline", {
    user: { id: "student-1", role: "aluno" },
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "CRM_ACCESS_DENIED");
  assert.equal((await request("/internal/crm/pipeline", { method: "POST" })).status, 404);
});
