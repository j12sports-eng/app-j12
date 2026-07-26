const assert = require("node:assert/strict");
const test = require("node:test");
const { DigitalEnrollmentFormGateway } = require("./digital-enrollment-form.gateway.js");
const { FOUNDATION_BLOCKER, PUBLIC_ERROR_CODE } = require("../application/services/digital-enrollment-contract.service.js");

const INVITATION = { enrollmentId: "enrollment-1", invitationId: "invitation-1" };

test("getForm returns resumable canonical data", async () => {
  const { gateway } = fixture();
  const form = await gateway.executeDigitalEnrollmentOperation({ invitation: INVITATION, operation: "getForm" });
  assert.equal(form.responsible.name, "Responsavel");
  assert.equal(form.student.name, "Aluno");
  assert.equal(form.progress.revision, 1);
});

test("partial writes persist each allowlisted step and increment revision", async () => {
  const { gateway, state } = fixture();
  let form = await gateway.executeDigitalEnrollmentOperation({ command: { fields: { name: "Responsavel Atualizado" }, revision: 1 }, invitation: INVITATION, operation: "updateResponsible" });
  assert.equal(form.responsible.name, "Responsavel Atualizado");
  form = await gateway.executeDigitalEnrollmentOperation({ command: { fields: { birthDate: "2014-05-06", name: "Aluno Atualizado" }, revision: 2 }, invitation: INVITATION, operation: "updateStudent" });
  assert.equal(form.student.birthDate, "2014-05-06");
  form = await gateway.executeDigitalEnrollmentOperation({ command: { fields: { city: "Goiania", zipCode: "74000-000" }, revision: 3 }, invitation: INVITATION, operation: "updateAddress" });
  assert.equal(form.address.city, "Goiania");
  form = await gateway.executeDigitalEnrollmentOperation({ command: { fields: {}, revision: 4 }, invitation: INVITATION, operation: "updateAdditionalInformation" });
  assert.equal(form.progress.revision, 5);
  assert.equal(state.progress.updatedByInvitationId, "invitation-1");
});

test("advance remains sequential through DOCUMENTS", async () => {
  const { gateway, state } = fixture();
  for (const [revision, targetStep] of [[1, "STUDENT_DATA"], [2, "ADDRESS"], [3, "ADDITIONAL_INFORMATION"], [4, "DOCUMENTS"]]) {
    await gateway.executeDigitalEnrollmentOperation({ command: { fields: { targetStep }, revision }, invitation: INVITATION, operation: "advanceStep" });
  }
  assert.equal(state.progress.currentStep, "DOCUMENTS");
  assert.equal(state.progress.revision, 5);
  assert.deepEqual(state.progress.completedSteps, ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION"]);
});

test("DOCUMENTS to REVIEW fails closed without changing or persisting progress", async () => {
  const initialProgress = {
    completedSteps: ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION"],
    currentStep: "DOCUMENTS",
    readyForReviewAt: null,
    revision: 5,
    status: "IN_PROGRESS",
  };
  const { gateway, state } = fixture({ progress: initialProgress });
  const before = structuredClone(state.progress);
  await assert.rejects(
    () => gateway.executeDigitalEnrollmentOperation({ command: { fields: { targetStep: "REVIEW" }, revision: 5 }, invitation: INVITATION, operation: "advanceStep" }),
    (error) => error.code === PUBLIC_ERROR_CODE && error.blocker === FOUNDATION_BLOCKER && error.statusCode === 503,
  );
  assert.equal(state.progressUpdateCalls, 0);
  assert.deepEqual(state.progress, before);
  assert.equal(state.progress.revision, 5);
  assert.deepEqual(state.progress.completedSteps, initialProgress.completedSteps);
  assert.equal(state.progress.currentStep, "DOCUMENTS");
  assert.equal(state.progress.status, "IN_PROGRESS");
  assert.equal(state.progress.readyForReviewAt, null);
});

test("step jumps remain invalid", async () => {
  const { gateway, state } = fixture();
  await assert.rejects(
    () => gateway.executeDigitalEnrollmentOperation({ command: { fields: { targetStep: "ADDRESS" }, revision: 1 }, invitation: INVITATION, operation: "advanceStep" }),
    { code: "DIGITAL_ENROLLMENT_INVALID_STEP", statusCode: 400 },
  );
  assert.equal(state.progressUpdateCalls, 0);
});

test("advance preserves optimistic revision conflicts before REVIEW blocking", async () => {
  const { gateway, state } = fixture({ progress: { currentStep: "DOCUMENTS", revision: 5, status: "IN_PROGRESS" } });
  await assert.rejects(
    () => gateway.executeDigitalEnrollmentOperation({ command: { fields: { targetStep: "REVIEW" }, revision: 4 }, invitation: INVITATION, operation: "advanceStep" }),
    { code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT", statusCode: 409 },
  );
  assert.equal(state.progressUpdateCalls, 0);
});
test("stale revision returns controlled conflict without merging", async () => {
  const { gateway, state } = fixture();
  await assert.rejects(() => gateway.executeDigitalEnrollmentOperation({ command: { fields: { name: "Stale" }, revision: 2 }, invitation: INVITATION, operation: "updateStudent" }), { code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT", statusCode: 409 });
  assert.equal(state.people["student-1"].name.fullName, "Aluno");
});

for (const [name, override] of [
  ["enrollment ACTIVE", { enrollment: { status: "ACTIVE" } }],
  ["ownership invalid", { relationship: { relatedPersonId: "other" } }],
  ["progress missing", { progress: null }],
]) {
  test(`fails closed when ${name}`, async () => {
    const { gateway } = fixture(override);
    await assert.rejects(() => gateway.executeDigitalEnrollmentOperation({ invitation: INVITATION, operation: "getForm" }), { code: "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE" });
  });
}

function fixture(overrides = {}) {
  const baseEnrollment = { id: "enrollment-1", responsiblePersonId: "responsible-1", responsibleProfileId: "responsible-profile-1", responsibleRelationshipId: "relationship-1", status: "DRAFT", studentPersonId: "student-1", studentProfileId: "student-profile-1" };
  const state = {
    enrollment: { ...baseEnrollment, ...(overrides.enrollment || {}) },
    relationship: { personId: "responsible-1", relatedPersonId: "student-1", status: "active", ...(overrides.relationship || {}) },
    progress: overrides.progress === null ? null : { completedSteps: [], currentStep: "RESPONSIBLE_DATA", enrollmentId: "enrollment-1", responsibleRelationshipId: "relationship-1", revision: 1, status: "NOT_STARTED", ...(overrides.progress || {}) },
    progressUpdateCalls: 0,
    people: {
      "responsible-1": { address: {}, contact: { email: "r@example.test", phone: "62999990000" }, name: { fullName: "Responsavel" } },
      "student-1": { address: {}, birthDate: null, contact: {}, name: { fullName: "Aluno" } },
    },
  };
  const queryRunner = async (sql, params) => {
    if (!sql.startsWith("UPDATE people SET")) throw new Error("Unexpected SQL");
    const personId = params.at(-1);
    const person = state.people[personId];
    const columns = [...sql.slice(0, sql.indexOf(" WHERE ")).matchAll(/([a-z_]+) = \?/g)].map((match) => match[1]);
    columns.forEach((column, index) => applyColumn(person, column, params[index]));
    return { affectedRows: person ? 1 : 0 };
  };
  const context = {
    queryRunner,
    enrollmentRepository: { async findById() { return state.enrollment; } },
    personProfileRepository: { async findById(id) { return id === "responsible-profile-1" ? { personId: "responsible-1" } : id === "student-profile-1" ? { personId: "student-1" } : null; } },
    personRelationshipRepository: { async findById() { return state.relationship; } },
    personRepository: { async findById(id) { return state.people[id] || null; } },
    digitalEnrollmentProgressRepository: {
      async findByEnrollmentId() { return state.progress; },
      async updateIfRevisionMatches(input) {
        state.progressUpdateCalls += 1;
        if (!state.progress || state.progress.revision !== input.expectedRevision) { const error = new Error("conflict"); error.code = "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT"; error.statusCode = 409; throw error; }
        state.progress = { ...state.progress, ...input.patch, revision: state.progress.revision + 1 };
        return state.progress;
      },
    },
  };
  return { gateway: new DigitalEnrollmentFormGateway({ transactionRunner: async (callback) => callback(context) }), state };
}
function applyColumn(person, column, value) {
  const map = { nome: ["name", "fullName"], email: ["contact", "email"], telefone: ["contact", "phone"], data_nascimento: ["birthDate"], cep: ["address", "zipCode"], logradouro: ["address", "street"], numero: ["address", "number"], bairro: ["address", "district"], cidade: ["address", "city"], estado: ["address", "state"], complemento: ["address", "complement"] };
  const path = map[column];
  if (path.length === 1) person[path[0]] = value; else person[path[0]][path[1]] = value;
}
test("read-only advance inspection returns only minimal frozen REVIEW context", async () => {
  const initialProgress = {
    completedSteps: ["RESPONSIBLE_DATA", "STUDENT_DATA", "ADDRESS", "ADDITIONAL_INFORMATION"],
    currentStep: "DOCUMENTS",
    readyForReviewAt: null,
    revision: 5,
    status: "IN_PROGRESS",
  };
  const { gateway, state } = fixture({ progress: initialProgress });
  const before = structuredClone(state.progress);
  const context = await gateway.inspectDigitalEnrollmentAdvance({
    command: { fields: { targetStep: "REVIEW" }, revision: 5 },
    invitation: INVITATION,
  });
  assert.deepEqual(context, {
    currentStep: "DOCUMENTS",
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
    revision: 5,
  });
  assert.equal(Object.isFrozen(context), true);
  assert.equal(state.progressUpdateCalls, 0);
  assert.deepEqual(state.progress, before);
  assert.doesNotMatch(JSON.stringify(context), /Responsavel|Aluno|email|phone|address|token/);
});

test("read-only advance inspection validates revision, step and REVIEW target", async (t) => {
  await t.test("revision", async () => {
    const { gateway, state } = fixture({ progress: { currentStep: "DOCUMENTS", revision: 5, status: "IN_PROGRESS" } });
    await assert.rejects(() => gateway.inspectDigitalEnrollmentAdvance({ command: { fields: { targetStep: "REVIEW" }, revision: 4 }, invitation: INVITATION }), { code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT" });
    assert.equal(state.progressUpdateCalls, 0);
  });
  await t.test("current step", async () => {
    const { gateway } = fixture({ progress: { currentStep: "ADDITIONAL_INFORMATION", revision: 5, status: "IN_PROGRESS" } });
    await assert.rejects(() => gateway.inspectDigitalEnrollmentAdvance({ command: { fields: { targetStep: "REVIEW" }, revision: 5 }, invitation: INVITATION }), { code: "DIGITAL_ENROLLMENT_INVALID_STEP" });
  });
  await t.test("target step", async () => {
    const { gateway } = fixture({ progress: { currentStep: "DOCUMENTS", revision: 5, status: "IN_PROGRESS" } });
    await assert.rejects(() => gateway.inspectDigitalEnrollmentAdvance({ command: { fields: { targetStep: "DOCUMENTS" }, revision: 5 }, invitation: INVITATION }), { code: "DIGITAL_ENROLLMENT_INVALID_STEP" });
  });
});

test("read-only advance inspection preserves DRAFT and ownership validation", async (t) => {
  for (const [name, override] of [
    ["Enrollment DRAFT", { enrollment: { status: "ACTIVE" } }],
    ["ownership", { relationship: { relatedPersonId: "other" } }],
  ]) {
    await t.test(name, async () => {
      const { gateway, state } = fixture(override);
      await assert.rejects(() => gateway.inspectDigitalEnrollmentAdvance({ command: { fields: { targetStep: "REVIEW" }, revision: 1 }, invitation: INVITATION }), { code: "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE" });
      assert.equal(state.progressUpdateCalls, 0);
    });
  }
});