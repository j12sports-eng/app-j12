const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentDigitalInvitationService,
} = require("../../application/services/enrollment-digital-invitation.service.js");
const {
  ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
} = require("../../application/services/enrollment-public-application.service.js");
const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");
const { createEnrollmentDigitalPublicRouter } = require("./enrollment-digital-public.routes.js");

test("public digital endpoint integrates token hash, invitation, Enrollment and safe DTO", async () => {
  const enrollmentRepository = new PublicEnrollmentRepository();
  const invitationRepository = new MemoryEnrollmentDigitalInvitationRepository();
  const invitationService = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: () => new Date("2026-07-29T12:00:00.000Z"),
    enrollmentReader: enrollmentRepository,
    invitationRepository,
    tokenGenerator: () => "A".repeat(43),
  });
  const created = await invitationService.createInvitation(
    { durationSeconds: 300, enrollmentId: "draft-1" },
    { actorId: "admin-1", unitId: "12" },
  );
  const writes = [];
  const savedForm = {
    progress: { currentStep: "STUDENT_DATA", revision: 2, status: "IN_PROGRESS" },
  };
  const router = createEnrollmentDigitalPublicRouter({
    enrollmentRepository,
    formGateway: {
      async executeDigitalEnrollmentOperation(input) {
        writes.push(input);
        return savedForm;
      },
    },
    invitationRepository,
    invitationService,
  });

  const valid = await dispatch(router, `/${created.rawToken}`);
  const missing = await dispatch(router, `/${"Z".repeat(43)}`);
  const persisted = await dispatch(router, `/${created.rawToken}`, {
    body: { fields: { name: "Aluno Atualizado" }, revision: 1, section: "student" },
    method: "PATCH",
  });
  const missingPatch = await dispatch(router, `/${"Z".repeat(43)}`, {
    body: { fields: {}, revision: 1, section: "student" },
    method: "PATCH",
  });

  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, {
    student: { name: "Aluno Integracao", birthDate: "2013-09-10", gender: "F" },
    invitation: { status: "ACTIVE", expiresAt: "2026-07-29 12:05:00" },
  });
  assert.equal(JSON.stringify(valid.body).includes(created.rawToken), false);
  assert.equal(JSON.stringify(valid.body).includes("tokenHash"), false);
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(persisted.body, { data: savedForm, success: true });
  assert.equal(missingPatch.statusCode, 404);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].operation, "updateStudent");
  assert.deepEqual(writes[0].command, { fields: { name: "Aluno Atualizado" }, revision: 1 });
  assert.equal(writes[0].invitation.enrollment.status, "DRAFT");
  assert.deepEqual(missing.body, {
    code: ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
    error: "Convite de matricula digital indisponivel.",
    success: false,
  });
});

class PublicEnrollmentRepository {
  async findById(id) {
    return id === "draft-1" ? { id, status: "DRAFT", unitId: "12" } : null;
  }

  async findPublicById({ enrollmentId, unitId }) {
    return enrollmentId === "draft-1" && unitId === "12"
      ? {
          enrollmentId,
          status: "DRAFT",
          student: { birthDate: "2013-09-10", gender: "F", name: "Aluno Integracao" },
          unitId,
        }
      : null;
  }
}

function dispatch(router, url, { body, method = "GET" } = {}) {
  const response = createResponse();
  return new Promise((resolve, reject) => {
    const json = response.json.bind(response);
    response.json = (body) => {
      json(body);
      resolve(response);
      return response;
    };
    router.handle({ body, headers: {}, method, url }, response, (error) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function createResponse() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
