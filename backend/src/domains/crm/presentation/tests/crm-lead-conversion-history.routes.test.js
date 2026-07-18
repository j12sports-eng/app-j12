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
    conversionHistoryQueryService: options.conversionHistoryQueryService || {
      async listConversions() {
        return {
          items: [{ id: "conversion-1", enrollmentStatus: "DRAFT" }],
          pageInfo: { hasNextPage: false, nextCursor: null },
        };
      },
      async getConversionById(id) {
        return { id, enrollmentStatus: "DRAFT" };
      },
    },
    conversionService: {
      async convertLeadToDraftEnrollment() {
        return { preserved: true };
      },
    },
    leadRepository: {
      async findUnitContextById() {
        return { id: "lead-1", unit_id: "unit-1" };
      },
    },
    queryService: {
      async listLeads() {
        return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
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

test("history list and detail are available on internal and /api aliases", async () => {
  const list = await request("/internal/crm/conversions?enrollmentStatus=DRAFT");
  const apiList = await request("/api/internal/crm/conversions");
  const detail = await request("/internal/crm/conversions/conversion-1");

  assert.equal(list.status, 200);
  assert.equal(apiList.status, 200);
  assert.equal(detail.status, 200);
  assert.equal((await list.json()).data.items[0].id, "conversion-1");
  assert.equal((await detail.json()).data.enrollmentStatus, "DRAFT");
});

test("history routes require authentication and CRM authorization", async () => {
  const unauthenticated = await request("/internal/crm/conversions", { skipAuth: true });
  assert.equal(unauthenticated.status, 401);

  const unauthorized = await request("/internal/crm/conversions", {
    user: { id: "student-1", role: "aluno" },
  });
  assert.equal(unauthorized.status, 403);
  assert.equal((await unauthorized.json()).code, "CRM_ACCESS_DENIED");
});

test("history route preserves 400, sanitized 404 and the existing POST", async () => {
  const invalid = await request("/internal/crm/conversions?resolution=CREATED");
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "CRM_INPUT_INVALID");

  const missing = await request("/internal/crm/conversions/missing", {
    conversionHistoryQueryService: {
      async listConversions() {},
      async getConversionById() {
        throw Object.assign(new Error("not found"), {
          code: "CRM_CONVERSION_HISTORY_NOT_FOUND",
          statusCode: 404,
        });
      },
    },
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "CRM_CONVERSION_HISTORY_NOT_FOUND");

  const post = await request("/internal/crm/leads/lead-1/draft-enrollment", { method: "POST" });
  assert.equal(post.status, 200);
  assert.deepEqual((await post.json()).data, { preserved: true });
});

test("history route never returns repository error details or PII", async () => {
  const response = await request("/internal/crm/conversions", {
    conversionHistoryQueryService: {
      async listConversions() {
        throw Object.assign(new Error("SQL CPF 52998224725 stack"), {
          code: "CRM_CONVERSION_HISTORY_FAILED",
          statusCode: 500,
        });
      },
      async getConversionById() {},
    },
  });
  const payload = await response.json();
  assert.equal(response.status, 500);
  assert.equal(payload.code, "CRM_CONVERSION_HISTORY_FAILED");
  assert.equal(JSON.stringify(payload).includes("52998224725"), false);
  assert.equal(JSON.stringify(payload).includes("SQL"), false);
  assert.equal(JSON.stringify(payload).includes("stack"), false);
});
