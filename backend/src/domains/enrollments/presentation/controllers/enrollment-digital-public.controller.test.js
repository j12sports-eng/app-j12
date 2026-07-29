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
