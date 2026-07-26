const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DIGITAL_ENROLLMENT_FOUNDATION_BLOCKED_CODE,
  DigitalEnrollmentFormApplicationService,
} = require("../services/digital-enrollment-form-application.service.js");

const {
  DigitalEnrollmentContractService,
  FOUNDATION_BLOCKER,
  PUBLIC_ERROR_CODE,
} = require("../services/digital-enrollment-contract.service.js");
const {
  EvaluateDigitalEnrollmentDocumentCompletionService,
} = require("../services/evaluate-digital-enrollment-document-completion.service.js");

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
test("non-REVIEW advances keep the existing delegation path", async () => {
  const { calls, service } = reviewFixture();
  await service.advanceStep("raw-token", { fields: { targetStep: "DOCUMENTS" }, revision: 4 });
  assert.equal(calls.execute, 1);
  assert.equal(calls.inspect, 0);
});

test("REVIEW revalidates invitation, inspects without writing and never forwards rawToken", async () => {
  const { calls, progress, service } = reviewFixture({ completion: { complete: false } });
  const before = structuredClone(progress);
  await assert.rejects(() => service.advanceStep("raw-token-secret", { fields: { targetStep: "REVIEW" }, revision: 5 }), {
    code: "DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE",
  });
  assert.equal(calls.resolve, 1);
  assert.equal(calls.inspect, 1);
  assert.equal(calls.execute, 0);
  assert.equal(calls.progressWrites, 0);
  assert.deepEqual(progress, before);
  assert.doesNotMatch(JSON.stringify(calls.providerContext), /raw-token-secret|storageKey|cpf|email/i);
});

test("inspection conflicts and non-DOCUMENTS context stop before document evaluation", async (t) => {
  await t.test("revision conflict", async () => {
    const conflict = Object.assign(new Error("conflict"), { code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT", statusCode: 409 });
    const { calls, service } = reviewFixture({ inspectError: conflict });
    await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 4 }), { code: conflict.code });
    assert.equal(calls.provider, 0);
    assert.equal(calls.completion, 0);
  });
  await t.test("wrong current step", async () => {
    const { calls, service } = reviewFixture({ context: { currentStep: "ADDITIONAL_INFORMATION", revision: 5 } });
    await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }), { code: "DIGITAL_ENROLLMENT_INVALID_COMMAND" });
    assert.equal(calls.provider, 0);
  });
});

test("missing or invalid document requirement provider fails closed", async (t) => {
  await t.test("provider absent", async () => {
    const { service } = reviewFixture({ provider: null });
    await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }), { code: "DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED", statusCode: 503 });
  });
  await t.test("provider returns undefined", async () => {
    const { service } = reviewFixture({ requiredDocumentTypes: undefined });
    await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }), { code: "DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED" });
  });
});

test("an explicitly empty requirement is valid and reaches the canonical contract blocker", async () => {
  const { calls, service } = reviewFixture({ completion: { complete: true }, requiredDocumentTypes: [] });
  await assert.rejects(
    () => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }),
    (error) => error.code === PUBLIC_ERROR_CODE && error.blocker === FOUNDATION_BLOCKER,
  );
  assert.deepEqual(calls.completionInput.requiredDocumentTypes, []);
  assert.equal(calls.execute, 0);
});

test("missing document repository fails closed before contract evaluation", async () => {
  const { calls, service } = reviewFixture({
    completionService: new EvaluateDigitalEnrollmentDocumentCompletionService(),
    requiredDocumentTypes: [],
  });
  await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }), {
    code: "DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE",
    expose: false,
  });
  assert.equal(calls.contract, 0);
});

for (const [name, completion] of [
  ["required document missing", { complete: false, missingTypes: ["CPF"], rejectedTypes: [] }],
  ["required document rejected", { complete: false, missingTypes: ["CPF"], rejectedTypes: ["CPF"] }],
]) {
  test(`${name} blocks REVIEW without exposing document internals`, async () => {
    const { calls, progress, service } = reviewFixture({ completion });
    await assert.rejects(
      () => service.advanceStep("raw-secret", { fields: { targetStep: "REVIEW" }, revision: 5 }),
      (error) => {
        assert.equal(error.code, "DIGITAL_ENROLLMENT_DOCUMENTS_INCOMPLETE");
        assert.equal(error.statusCode, 409);
        assert.equal(error.expose, true);
        assert.doesNotMatch(JSON.stringify(error), /raw-secret|storageKey|sha256|originalName|CPF/);
        return true;
      },
    );
    assert.equal(calls.contract, 0);
    assert.equal(calls.execute, 0);
    assert.equal(progress.revision, 5);
    assert.equal(progress.currentStep, "DOCUMENTS");
    assert.equal(progress.status, "IN_PROGRESS");
  });
}

test("complete documents reach only contract availability and create no contract or financial data", async () => {
  const { calls, progress, service } = reviewFixture({ completion: { complete: true } });
  const before = structuredClone(progress);
  await assert.rejects(() => service.advanceStep("token", { fields: { targetStep: "REVIEW" }, revision: 5 }), {
    code: PUBLIC_ERROR_CODE,
    blocker: FOUNDATION_BLOCKER,
  });
  assert.equal(calls.contract, 1);
  assert.equal(calls.execute, 0);
  assert.equal(calls.progressWrites, 0);
  assert.equal(calls.contractCreates, 0);
  assert.equal(calls.financialWrites, 0);
  assert.deepEqual(progress, before);
});

function reviewFixture(overrides = {}) {
  const progress = {
    completedSteps: ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION"],
    currentStep: "DOCUMENTS",
    readyForReviewAt: null,
    revision: 5,
    status: "IN_PROGRESS",
  };
  const calls = { completion: 0, contract: 0, contractCreates: 0, execute: 0, financialWrites: 0, inspect: 0, progressWrites: 0, provider: 0, resolve: 0 };
  const baseContext = { currentStep: "DOCUMENTS", enrollmentId: "enrollment-1", responsibleRelationshipId: "relationship-1", revision: 5 };
  const context = Object.freeze({ ...baseContext, ...(overrides.context || {}) });
  const aggregateGateway = {
    async executeDigitalEnrollmentOperation() { calls.execute += 1; return { ok: true }; },
    async inspectDigitalEnrollmentAdvance() {
      calls.inspect += 1;
      if (overrides.inspectError) throw overrides.inspectError;
      return context;
    },
  };
  const hasRequiredTypes = Object.prototype.hasOwnProperty.call(overrides, "requiredDocumentTypes");
  const documentRequirementProvider = overrides.provider === null ? null : {
    async getRequiredDocumentTypes(providerContext) {
      calls.provider += 1;
      calls.providerContext = providerContext;
      return hasRequiredTypes ? overrides.requiredDocumentTypes : ["CPF"];
    },
  };
  const documentCompletionService = overrides.completionService || {
    async execute(input) {
      calls.completion += 1;
      calls.completionInput = input;
      return overrides.completion || { complete: true };
    },
  };
  const canonicalContractService = new DigitalEnrollmentContractService();
  const contractService = {
    async getContract() {
      calls.contract += 1;
      return canonicalContractService.getContract();
    },
  };
  const service = new DigitalEnrollmentFormApplicationService({
    aggregateGateway,
    contractService,
    documentCompletionService,
    documentRequirementProvider,
    invitationResolver: {
      async resolveInvitationByRawToken() {
        calls.resolve += 1;
        return { enrollmentId: "enrollment-1", invitationId: "invitation-1" };
      },
    },
  });
  return { calls, progress, service };
}