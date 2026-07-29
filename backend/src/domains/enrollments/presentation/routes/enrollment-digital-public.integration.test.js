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
  const router = createEnrollmentDigitalPublicRouter({
    enrollmentRepository,
    invitationRepository,
    invitationService,
  });

  const valid = await dispatch(router, `/${created.rawToken}`);
  const missing = await dispatch(router, `/${"Z".repeat(43)}`);

  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, {
    student: { name: "Aluno Integracao", birthDate: "2013-09-10", gender: "F" },
    invitation: { status: "ACTIVE", expiresAt: "2026-07-29 12:05:00" },
  });
  assert.equal(JSON.stringify(valid.body).includes(created.rawToken), false);
  assert.equal(JSON.stringify(valid.body).includes("tokenHash"), false);
  assert.equal(missing.statusCode, 404);
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

function dispatch(router, url) {
  const response = createResponse();
  return new Promise((resolve, reject) => {
    const json = response.json.bind(response);
    response.json = (body) => {
      json(body);
      resolve(response);
      return response;
    };
    router.handle({ headers: {}, method: "GET", url }, response, (error) => {
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
