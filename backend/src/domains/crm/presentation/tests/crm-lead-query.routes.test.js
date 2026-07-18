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
          req.correlationId = "corr-1";
          next();
        },
    conversionService: options.conversionService || {
      async convertLeadToDraftEnrollment() {
        return { preserved: true };
      },
    },
    leadRepository: options.leadRepository || {
      async findUnitContextById() {
        return { id: "lead-1", unit_id: "unit-1" };
      },
    },
    queryService: options.queryService || {
      async listLeads() {
        return { items: [{ id: "lead-1" }], pageInfo: { hasNextPage: false, nextCursor: null } };
      },
      async getLeadById() {
        return { id: "lead-1" };
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
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: options.method || "GET",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("internal and /api GET list/detail routes use auth and query service", async () => {
  const list = await request("/internal/crm/leads");
  const apiList = await request("/api/internal/crm/leads");
  assert.equal(apiList.status, 200);
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data.items, [{ id: "lead-1" }]);
  const detail = await request("/internal/crm/leads/lead-1");
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.id, "lead-1");
});

test("authentication is mandatory", async () => {
  const response = await request("/internal/crm/leads", { skipAuth: true });
  assert.equal(response.status, 401);
});

test("unauthorized role receives CRM_ACCESS_DENIED and POST remains mounted", async () => {
  const denied = await request("/internal/crm/leads", { user: { id: "student-1", role: "aluno" } });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "CRM_ACCESS_DENIED");
  const post = await request("/internal/crm/leads/lead-1/draft-enrollment", { method: "POST" });
  assert.equal(post.status, 200);
  assert.deepEqual((await post.json()).data, { preserved: true });
});

test("query service errors are forwarded without SQL", async () => {
  const response = await request("/internal/crm/leads", {
    queryService: {
      async listLeads() {
        throw Object.assign(new Error("SQL CPF 52998224725"), {
          code: "CRM_LEAD_QUERY_FAILED",
          statusCode: 500,
        });
      },
      async getLeadById() {},
    },
  });
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.code, "CRM_LEAD_QUERY_FAILED");
  assert.equal(JSON.stringify(payload).includes("52998224725"), false);
});
