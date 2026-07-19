const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const {
  PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH,
  createPreEnrollmentInternalRouter,
} = require("../routes/pre-enrollment-internal.routes.js");

test("internal route requires authentication, management access and authenticated unit", async () => {
  assert.equal((await request({ authenticated: false })).status, 401);
  assert.equal(
    (await request({ user: { id: "student-1", role: "aluno", unitId: "unit-1" } })).status,
    403,
  );
  const missingUnit = await request({ user: { id: "admin-1", role: "admin" } });
  assert.equal(missingUnit.status, 403);
  assert.equal((await missingUnit.json()).code, "PRE_ENROLLMENT_UNIT_SCOPE_REQUIRED");
});

test("controller derives userId and unitId exclusively from authenticated context", async () => {
  let received;
  const response = await request({
    body: input(),
    service: {
      async startPreEnrollment(data, context) {
        received = { context, data };
        return safeResult("DRAFT_CREATED");
      },
    },
  });
  assert.equal(response.status, 201);
  assert.equal(received.context.userId, "admin-1");
  assert.equal(received.context.unitId, "unit-1");
  assert.equal(received.context.authorization.scope, "PRE_ENROLLMENT_INTERNAL_CREATE");
  assert.equal(Object.hasOwn(received.data, "userId"), false);
  assert.equal(Object.hasOwn(received.data, "unitId"), false);
});

test("body context, mass assignment and unknown top-level fields are rejected", async () => {
  for (const body of [
    { ...input(), unitId: "attacker-unit" },
    { ...input(), userId: "attacker-user" },
    { ...input(), payment: { amount: 100 } },
  ]) {
    let called = false;
    const response = await request({
      body,
      service: {
        async startPreEnrollment() {
          called = true;
        },
      },
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "PRE_ENROLLMENT_HTTP_INPUT_INVALID");
    assert.equal(called, false);
  }
});

test("DRAFT reuse returns 200 and response contains identifiers only", async () => {
  const response = await request({
    body: input(),
    service: {
      async startPreEnrollment() {
        return safeResult("DRAFT_REUSED");
      },
    },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.status, "DRAFT_REUSED");
  assert.doesNotMatch(
    JSON.stringify(payload),
    /52998224725|responsible@example\.test|payment|contract|token/u,
  );
});

test("ACTIVE, state conflict and internal failures use sanitized error mapping", async () => {
  for (const [code, statusCode] of [
    ["ENROLLMENT_ACTIVE_EXISTS", 409],
    ["ENROLLMENT_STATE_CONFLICT", 409],
    ["PRE_ENROLLMENT_START_FAILED", 500],
  ]) {
    const response = await request({
      body: input(),
      service: {
        async startPreEnrollment() {
          throw Object.assign(
            new Error(
              statusCode < 500 ? "Enrollment state blocks pre-enrollment." : "CPF 52998224725 SQL",
            ),
            {
              code,
              expose: statusCode < 500,
              statusCode,
            },
          );
        },
      },
    });
    const payload = await response.json();
    assert.equal(response.status, statusCode);
    assert.equal(payload.code, code);
    assert.doesNotMatch(JSON.stringify(payload), /52998224725|SQL/u);
  }
});

test("router exposes only the internal POST path", async () => {
  const internal = await request({ body: input() });
  const publicAttempt = await rawRequest("/pre-enrollments", { body: input() });
  assert.equal(internal.status, 201);
  assert.equal(publicAttempt.status, 404);
});

async function request(options = {}) {
  return rawRequest(PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH, options);
}

async function rawRequest(path, options = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH,
    createPreEnrollmentInternalRouter({
      authMiddleware(req, res, next) {
        if (options.authenticated === false) return res.status(401).json({ success: false });
        req.auth = options.user || { id: "admin-1", role: "admin", unitId: "unit-1" };
        req.correlationId = "correlation-1";
        return next();
      },
      preEnrollmentService: options.service || {
        async startPreEnrollment() {
          return safeResult("DRAFT_CREATED");
        },
      },
    }),
  );
  app.use((error, _req, res, _next) => {
    const status = error.statusCode || 500;
    return res.status(status).json({
      code: error.code || "INTERNAL_ERROR",
      message: status >= 500 && !error.expose ? "Erro interno do servidor." : error.message,
      success: false,
    });
  });
  const server = app.listen(0);
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      body: JSON.stringify(options.body || {}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function input() {
  return {
    enrollment: { startDate: "2026-07-20" },
    responsible: { cpf: "52998224725", nome: "Responsavel" },
    student: { cpf: "11144477735", dataNascimento: "2012-03-04", nome: "Aluno", sexo: "M" },
  };
}

function safeResult(status) {
  return {
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    relationshipId: "relationship-1",
    responsiblePersonId: "responsible-1",
    responsibleProfileId: "responsible-profile-1",
    reused: { enrollment: status === "DRAFT_REUSED" },
    status,
    studentPersonId: "student-1",
    studentProfileId: "student-profile-1",
  };
}
