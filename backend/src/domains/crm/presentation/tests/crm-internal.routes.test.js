const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(options = {}) {
  const app = express(); app.use(express.json());
  app.use("/internal/crm", createCrmInternalRouter({ authMiddleware(req, _res, next) { req.user = { id: "admin-1", role: "admin" }; next(); }, accessMiddleware: (_req, _res, next) => next(), conversionService: options.conversionService }));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ code: error.code, success: false }));
  const server = app.listen(0);
  try { return await fetch(`http://127.0.0.1:${server.address().port}/internal/crm/leads/lead-1/draft-enrollment`, { body: JSON.stringify(options.body || {}), headers: { "content-type": "application/json" }, method: "POST" }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("route delegates lead, authenticated actor and unit", async () => {
  let received;
  const response = await request({ body: { unitId: "unit-1", enrollmentData: { startDate: "2026-07-18" } }, conversionService: { async convertLeadToDraftEnrollment(input, context) { received = { input, context }; return { enrollmentId: "enrollment-1" }; } } });
  assert.equal(response.status, 200); assert.equal(received.input.leadId, "lead-1"); assert.deepEqual(received.context, { unitId: "unit-1", userId: "admin-1" });
});

test("route rejects missing unit before calling the service", async () => {
  let called = false; const response = await request({ conversionService: { async convertLeadToDraftEnrollment() { called = true; } } });
  assert.equal(response.status, 400); assert.equal(called, false);
});

test("route forwards application errors", async () => {
  const response = await request({ body: { unitId: "unit-1" }, conversionService: { async convertLeadToDraftEnrollment() { throw Object.assign(new Error("conflict"), { code: "CRM_LEAD_ENROLLMENT_CONFLICT", statusCode: 409 }); } } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, "CRM_LEAD_ENROLLMENT_CONFLICT");
});
