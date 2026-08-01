const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
} = require("../../application/services/enrollment-public-application.service.js");
const {
  ENROLLMENT_PUBLIC_ERROR_MESSAGE,
  EnrollmentDigitalPublicController,
} = require("./enrollment-digital-public.controller.js");

test("EnrollmentDigitalPublicController reads the token and returns the public DTO", async () => {
  const token = "A".repeat(43);
  const dto = {
    student: { name: "Aluno", birthDate: "2014-05-06", gender: "M" },
    invitation: { status: "ACTIVE", expiresAt: "2026-08-05 12:00:00" },
  };
  const controller = new EnrollmentDigitalPublicController({
    enrollmentPublicApplicationService: {
      async resolveDigitalEnrollmentByToken(command) {
        assert.deepEqual(command, { token });
        return dto;
      },
    },
  });
  const res = createResponse();

  await controller.getByToken({ params: { token } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, dto);
});

test("EnrollmentDigitalPublicController forwards the canonical section command", async () => {
  const token = "A".repeat(43);
  const data = { progress: { revision: 3 } };
  const controller = new EnrollmentDigitalPublicController({
    formService: {
      async updateSection(receivedToken, command) {
        assert.equal(receivedToken, token);
        assert.deepEqual(command, {
          fields: { name: "Aluno" },
          revision: 2,
          section: "student",
        });
        return data;
      },
    },
  });
  const res = createResponse();
  await controller.patchByToken(
    {
      params: { token },
      body: { fields: { name: "Aluno" }, revision: 2, section: "student", unitId: "ignored" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { data, success: true });
});

test("EnrollmentDigitalPublicController returns the same generic body for every failure", async () => {
  const logged = [];
  const controller = new EnrollmentDigitalPublicController({
    enrollmentPublicApplicationService: {
      async resolveDigitalEnrollmentByToken() {
        const error = new Error("sensitive internal detail");
        error.code = "INTERNAL_FAILURE";
        throw error;
      },
    },
    logger: {
      warn(_message, context) {
        logged.push(context);
      },
    },
  });
  const token = "A".repeat(43);
  const res = createResponse();

  await controller.getByToken({ params: { token } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    code: ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
    error: ENROLLMENT_PUBLIC_ERROR_MESSAGE,
    success: false,
  });
  assert.equal(JSON.stringify(logged).includes(token), false);
  assert.equal(JSON.stringify(res.body).includes("sensitive internal detail"), false);
});

for (const [statusCode, expectedStatus] of [
  [400, 400],
  [409, 409],
  [404, 404],
]) {
  test(`EnrollmentDigitalPublicController maps persistence failure ${statusCode}`, async () => {
    const controller = new EnrollmentDigitalPublicController({
      formService: {
        async updateSection() {
          throw Object.assign(new Error("internal"), { statusCode });
        },
      },
    });
    const res = createResponse();
    await controller.patchByToken({ params: { token: "A".repeat(43) }, body: {} }, res);
    assert.equal(res.statusCode, expectedStatus);
    assert.equal(res.body.success, false);
    assert.equal(JSON.stringify(res.body).includes("internal"), false);
  });
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
