const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(path, options = {}) {
  const app = express();
  app.use(
    "/internal/crm",
    createCrmInternalRouter({
      authMiddleware: options.skipAuth
        ? undefined
        : (req, _res, next) => {
            req.user = options.user || { id: "admin-1", role: "admin" };
            next();
          },
      conversionHistoryExportService: options.exportService || {
        async export() {
          return {
            buffer: Buffer.from("\uFEFFconversionId\r\n"),
            contentType: "text/csv; charset=utf-8",
            filename: "crm-conversions-2026-07-18.csv",
            rows: 0,
          };
        },
      },
      conversionHistoryQueryService: {
        async listConversions() {
          return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
        },
        async getConversionById() {
          return null;
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
    }),
  );
  app.use((error, _req, res, _next) =>
    res.status(error.statusCode || 500).json({ code: error.code }),
  );
  const server = app.listen(0);
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("exports on the internal route and keeps export before the id route", async () => {
  const response = await request("/internal/crm/conversions/export?dateFrom=2026-07-01");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(response.headers.get("content-disposition"), /crm-conversions/);
});

test("export route preserves auth and access boundaries", async () => {
  assert.equal((await request("/internal/crm/conversions/export", { skipAuth: true })).status, 401);
  const denied = await request("/internal/crm/conversions/export", {
    user: { id: "student-1", role: "aluno" },
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "CRM_ACCESS_DENIED");
});

test("export route sanitizes limit failures", async () => {
  const response = await request("/internal/crm/conversions/export", {
    exportService: {
      async export() {
        throw Object.assign(new Error("secret"), {
          code: "CRM_EXPORT_LIMIT_EXCEEDED",
          statusCode: 413,
        });
      },
    },
  });
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.code, "CRM_EXPORT_LIMIT_EXCEEDED");
  assert.equal(JSON.stringify(body).includes("secret"), false);
});
