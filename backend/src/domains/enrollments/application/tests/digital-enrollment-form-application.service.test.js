const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE,
  DigitalEnrollmentFormApplicationService,
} = require("../services/digital-enrollment-form-application.service.js");

test("digital enrollment foundation fails closed without exposing or persisting the token", async () => {
  const rawToken = "A".repeat(43);
  const logs = [];
  const service = new DigitalEnrollmentFormApplicationService({
    invitationResolver: {
      async resolveInvitationByRawToken(command) {
        assert.deepEqual(command, { rawToken });
        return { enrollmentId: "enrollment-1", invitationId: "invitation-1" };
      },
    },
    logger: {
      warn(message, metadata) {
        logs.push({ message, metadata });
      },
    },
  });

  await assert.rejects(() => service.getForm(rawToken), {
    code: DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE,
    statusCode: 503,
  });
  assert.equal(JSON.stringify(logs).includes(rawToken), false);
});

test("digital enrollment foundation revalidates invitation before every operation", async () => {
  let resolutions = 0;
  const operations = [];
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway: {
      async executeDigitalEnrollmentOperation(input) {
        operations.push(input.operation);
        return { blocked: false };
      },
    },
    invitationResolver: {
      async resolveInvitationByRawToken() {
        resolutions += 1;
        return { enrollmentId: "enrollment-1", invitationId: "invitation-1" };
      },
    },
  });

  await service.getForm("A".repeat(43));
  await service.updateStudent("A".repeat(43), { fields: { name: "Aluno" }, revision: 1 });

  assert.equal(resolutions, 2);
  assert.deepEqual(operations, ["getForm", "updateStudent"]);
});

test("digital enrollment foundation does not forward ids or mass-assignment fields", async () => {
  let received;
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway: {
      async executeDigitalEnrollmentOperation(input) {
        received = input;
        return { ok: true };
      },
    },
    invitationResolver: {
      async resolveInvitationByRawToken() {
        return { enrollmentId: "enrollment-1", invitationId: "invitation-1" };
      },
    },
  });

  await service.updateResponsible("A".repeat(43), {
    fields: { email: "responsible@example.test" },
    personId: "attacker",
    status: "ACTIVE",
    unitId: "other-unit",
    revision: 2,
  });

  assert.deepEqual(received.command, {
    fields: { email: "responsible@example.test" },
    revision: 2,
  });
});

test("digital enrollment foundation rejects unexpected fields inside a step", async () => {
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway: {
      async executeDigitalEnrollmentOperation() {
        assert.fail("gateway must not receive mass-assignment input");
      },
    },
    invitationResolver: {
      async resolveInvitationByRawToken() {
        return { enrollmentId: "enrollment-1", invitationId: "invitation-1" };
      },
    },
  });
  await assert.rejects(
    () =>
      service.updateResponsible("A".repeat(43), {
        fields: { email: "safe@example.test", status: "ACTIVE" },
        revision: 1,
      }),
    { code: DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE },
  );
});
test("digital enrollment writes require a positive revision", async () => {
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway: { async executeDigitalEnrollmentOperation() { assert.fail("gateway must not run"); } },
    invitationResolver: { async resolveInvitationByRawToken() { return { enrollmentId: "enrollment-1", invitationId: "invitation-1" }; } },
  });
  await assert.rejects(() => service.updateStudent("A".repeat(43), { fields: { name: "Aluno" } }), {
    code: "DIGITAL_ENROLLMENT_INVALID_COMMAND",
    statusCode: 400,
  });
});

test("expired invitation stops the operation before the aggregate transaction", async () => {
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway: { async executeDigitalEnrollmentOperation() { assert.fail("gateway must not run"); } },
    invitationResolver: { async resolveInvitationByRawToken() { throw Object.assign(new Error("unavailable"), { code: "ENROLLMENT_INVITATION_NOT_AVAILABLE" }); } },
  });
  await assert.rejects(() => service.getForm("A".repeat(43)), { code: "ENROLLMENT_INVITATION_NOT_AVAILABLE" });
});
