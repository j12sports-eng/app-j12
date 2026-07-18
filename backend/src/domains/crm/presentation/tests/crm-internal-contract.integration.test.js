const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const {
  CrmLeadEnrollmentConversionService,
} = require("../../application/crm-lead-enrollment-conversion.service.js");
const { createCrmInternalRouter } = require("../routes/crm-internal.routes.js");

test("real HTTP boundary derives trusted unit and works with the real conversion service", async () => {
  const calls = { enrollment: [], persistence: [], student: [] };
  const leadRepository = {
    async findUnitContextById(leadId) {
      return leadId === "lead-1" ? { id: leadId, unit_id: "unit-derived" } : null;
    },
  };
  const conversionService = new CrmLeadEnrollmentConversionService({
    authorizeUnit: (context, unitId) => context.unitId === unitId,
    enrollmentBoundary: {
      async resolveOrCreateDraftEnrollmentForResolvedStudent(data, context) {
        calls.enrollment.push({ data, context });
        return {
          enrollmentId: "enrollment-1",
          enrollmentStatus: "DRAFT",
          resolution: "CREATED",
          reused: false,
        };
      },
    },
    enrollmentConversionRepository: {
      async findByLeadId(data) {
        calls.persistence.push({ operation: "find", data });
        return null;
      },
      async create(data) {
        calls.persistence.push({ operation: "create", data });
        return { conversion: { ...data, id: "conversion-1" } };
      },
    },
    leadStudentConversionService: {
      async convertLeadToStudent(data, context) {
        calls.student.push({ data, context });
        return {
          leadId: data.leadId,
          personId: "person-1",
          personProfileId: "profile-1",
          resolutions: { person: "CREATED", profile: "CREATED" },
          reused: { person: false, profile: false },
        };
      },
    },
    now: () => new Date("2026-07-18T22:00:00.000Z"),
  });

  const response = await send({ body: validBody(), conversionService, leadRepository });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(calls.student[0].data.leadId, "lead-1");
  assert.equal(Object.hasOwn(calls.student[0].data, "unitId"), false);
  assert.equal(calls.student[0].context.unitId, "unit-derived");
  assert.equal(calls.student[0].context.userId, "admin-1");
  assert.equal(calls.student[0].context.correlationId, "correlation-1");
  assert.equal(calls.persistence[0].data.unitId, "unit-derived");
});

test("contract rejects extras before effects", async () => {
  for (const field of ["unitId", "userId", "studentId", "status", "plano", "financeiro"]) {
    const response = await send({ body: { ...validBody(), [field]: "forbidden" } });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "CRM_INPUT_INVALID");
  }
});

test("missing Lead, missing unit, denied access and infrastructure failures are deterministic", async () => {
  const missing = await send({
    leadRepository: {
      async findUnitContextById() {
        return null;
      },
    },
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "CRM_LEAD_NOT_FOUND");

  const unitless = await send({
    leadRepository: {
      async findUnitContextById() {
        return { id: "lead-1", unit_id: null };
      },
    },
  });
  assert.equal(unitless.status, 409);
  assert.equal((await unitless.json()).code, "CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE");

  const denied = await send({ user: { id: "student-1", role: "aluno" } });
  assert.equal(denied.status, 403);

  const failed = await send({
    leadRepository: {
      async findUnitContextById() {
        throw new Error("database host failure CPF 52998224725");
      },
    },
  });
  assert.equal(failed.status, 500);
  const failedPayload = await failed.json();
  assert.equal(failedPayload.code, "CRM_LEAD_UNIT_CONTEXT_FAILED");
  assert.equal(JSON.stringify(failedPayload).includes("52998224725"), false);
  assert.equal(JSON.stringify(failedPayload).includes("database host"), false);
});

async function send(options = {}) {
  const app = express();
  app.use(express.json());
  let conversionService = options.conversionService;
  if (!conversionService)
    conversionService = {
      async convertLeadToDraftEnrollment() {
        return {};
      },
    };
  app.use(
    "/internal/crm",
    createCrmInternalRouter({
      authMiddleware(req, _res, next) {
        req.user = options.user || { id: "admin-1", role: "admin" };
        req.correlationId = "correlation-1";
        next();
      },
      conversionService,
      leadRepository: options.leadRepository || {
        async findUnitContextById() {
          return { id: "lead-1", unit_id: "unit-derived" };
        },
      },
    }),
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.statusCode || 500)
      .json({ code: error.code || "INTERNAL_ERROR", success: false }),
  );
  const server = app.listen(0);
  try {
    return await fetch(
      `http://127.0.0.1:${server.address().port}/internal/crm/leads/lead-1/draft-enrollment`,
      {
        body: JSON.stringify(options.body || validBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function validBody() {
  return {
    studentData: { nome: "Aluno" },
    enrollmentData: { startDate: "2026-07-18" },
    idempotencyKey: "request-1",
  };
}
