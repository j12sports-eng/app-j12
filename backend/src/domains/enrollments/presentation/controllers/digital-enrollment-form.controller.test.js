const assert = require("node:assert/strict");
const test = require("node:test");
const { DigitalEnrollmentFormController } = require("./digital-enrollment-form.controller.js");

test("controller forwards only token and command to the form service", async () => {
  let received;
  const controller = new DigitalEnrollmentFormController({
    formService: {
      async updateStudent(token, command) {
        received = { command, token };
        return { progress: { revision: 2 } };
      },
    },
  });
  const res = response();
  await controller.updateStudent(
    {
      body: { fields: { name: "Aluno" }, revision: 1 },
      params: { token: "A".repeat(43) },
    },
    res,
  );
  assert.equal(received.token, "A".repeat(43));
  assert.deepEqual(received.command, { fields: { name: "Aluno" }, revision: 1 });
  assert.equal(res.body.success, true);
});

test("controller maps optimistic concurrency to a generic 409 without token leakage", async () => {
  const token = "A".repeat(43);
  const controller = new DigitalEnrollmentFormController({
    formService: {
      async updateAddress() {
        throw Object.assign(new Error(token), {
          code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT",
          statusCode: 409,
        });
      },
    },
  });
  const res = response();
  await controller.updateAddress({ body: {}, params: { token } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(JSON.stringify(res.body).includes(token), false);
});

function response() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}
