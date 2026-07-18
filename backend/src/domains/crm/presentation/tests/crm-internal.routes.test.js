const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

async function request(options = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/internal/crm",
    createCrmInternalRouter({
      authMiddleware(req, _res, next) {
        req.user = options.user || { id: "admin-1", role: "admin" };
        req.correlationId = "correlation-1";
        next();
      },
      conversionService: options.conversionService,
      leadRepository: options.leadRepository || {
        async findUnitContextById() {
          return { id: "lead-1", unit_id: "unit-1" };
        },
      },
    }),
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.statusCode || 500)
      .json({ code: error.code, details: error.details, success: false }),
  );
  const server = app.listen(0);
  try {
    return await fetch(
      `http://127.0.0.1:${server.address().port}/internal/crm/leads/lead-1/draft-enrollment`,
      {
        body: JSON.stringify(options.body || {}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("route derives unit and delegates separate input and trusted context", async () => {
  let received;
  const response = await request({
    body: { enrollmentData: { startDate: "2026-07-18" } },
    conversionService: {
      async convertLeadToDraftEnrollment(input, context) {
        received = { input, context };
        return { enrollmentId: "enrollment-1" };
      },
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(received.input, {
    leadId: "lead-1",
    studentData: undefined,
    enrollmentData: { startDate: "2026-07-18" },
    idempotencyKey: undefined,
  });
  assert.equal(received.context.unitId, "unit-1");
  assert.equal(received.context.userId, "admin-1");
  assert.equal(received.context.correlationId, "correlation-1");
  assert.equal(received.context.authorization.scope, "CRM_INTERNAL_MANAGE");
});

test("route rejects client-controlled context fields", async () => {
  let called = false;
  const response = await request({
    body: { unitId: "unit-attacker", userId: "user-attacker" },
    conversionService: {
      async convertLeadToDraftEnrollment() {
        called = true;
      },
    },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "CRM_INPUT_INVALID");
  assert.equal(called, false);
});

test("route preserves global administrator/coordinator authorization", async () => {
  const response = await request({
    user: { id: "student-1", role: "aluno" },
    conversionService: {
      async convertLeadToDraftEnrollment() {
        throw new Error("must not run");
      },
    },
  });
  assert.equal(response.status, 403);
});

test("route forwards sanitized application errors", async () => {
  const response = await request({
    conversionService: {
      async convertLeadToDraftEnrollment() {
        throw Object.assign(new Error("conflict"), {
          code: "CRM_LEAD_ENROLLMENT_CONFLICT",
          statusCode: 409,
        });
      },
    },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "CRM_LEAD_ENROLLMENT_CONFLICT");
});
