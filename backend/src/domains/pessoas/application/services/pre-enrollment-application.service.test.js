const assert = require("node:assert/strict");
const test = require("node:test");

const { AppError } = require("../../../../errors/app-error.js");
const {
  PRE_ENROLLMENT_ERROR_CODES,
  PreEnrollmentApplicationService,
} = require("./pre-enrollment-application.service.js");

test("creates the initial canonical DRAFT without financial or activation effects", async () => {
  const fixture = createFixture();
  const result = await fixture.service.startPreEnrollment(input(), fixture.context);

  assert.equal(result.status, "DRAFT_CREATED");
  assert.equal(result.enrollmentStatus, "DRAFT");
  assert.equal(result.enrollmentId, "enrollment-1");
  assert.deepEqual(result.reused, {
    enrollment: false,
    relationship: false,
    responsiblePerson: false,
    responsibleProfile: false,
    studentPerson: false,
    studentProfile: false,
  });
  assert.equal(fixture.state.draftCreations, 1);
  assert.deepEqual(fixture.state.draftBoundaryCalls, [
    {
      context: fixture.context,
      input: {
        personId: "student-person-1",
        personProfileId: "student-profile-1",
        responsiblePersonId: "responsible-person-1",
        responsibleProfileId: "responsible-profile-1",
        responsibleRelationshipId: "relationship-1",
        startDate: "2026-07-20",
      },
    },
  ]);
  assert.deepEqual(fixture.state.financialEffects, []);
  assert.deepEqual(fixture.state.activationEffects, []);
});

test("reuses an existing DRAFT and preserves the canonical result status", async () => {
  const fixture = createFixture({ existingDraft: true });
  const result = await fixture.service.startPreEnrollment(input(), fixture.context);

  assert.equal(result.status, "DRAFT_REUSED");
  assert.equal(result.enrollmentId, "enrollment-1");
  assert.equal(result.reused.enrollment, true);
  assert.equal(fixture.state.draftCreations, 0);
});

test("ACTIVE Enrollment blocks pre-enrollment before any DRAFT write", async () => {
  const fixture = createFixture({ enrollmentError: "ENROLLMENT_ACTIVE_EXISTS" });

  await assert.rejects(
    fixture.service.startPreEnrollment(input(), fixture.context),
    (error) => error.code === "ENROLLMENT_ACTIVE_EXISTS" && error.statusCode === 409,
  );
  assert.equal(fixture.state.draftCreations, 0);
});

test("Enrollment state conflict is preserved for assisted review", async () => {
  const fixture = createFixture({ enrollmentError: "ENROLLMENT_STATE_CONFLICT" });

  await assert.rejects(
    fixture.service.startPreEnrollment(input(), fixture.context),
    (error) => error.code === "ENROLLMENT_STATE_CONFLICT" && error.statusCode === 409,
  );
  assert.equal(fixture.state.draftCreations, 0);
});

test("existing responsible and student Pessoas are reused", async () => {
  const fixture = createFixture({ existingPeople: true });
  const result = await fixture.service.startPreEnrollment(input(), fixture.context);

  assert.equal(result.reused.responsiblePerson, true);
  assert.equal(result.reused.studentPerson, true);
  assert.equal(fixture.state.personCreations, 0);
  assert.equal(fixture.state.studentPersonCreations, 0);
});

test("existing responsible-student relationship is reused", async () => {
  const fixture = createFixture({ existingRelationship: true });
  const result = await fixture.service.startPreEnrollment(input(), fixture.context);

  assert.equal(result.relationshipId, "relationship-1");
  assert.equal(result.reused.relationship, true);
  assert.equal(fixture.state.relationshipCreations, 0);
});

test("repeated calls reuse every artifact and never duplicate the DRAFT", async () => {
  const fixture = createFixture();
  const first = await fixture.service.startPreEnrollment(input(), fixture.context);
  const second = await fixture.service.startPreEnrollment(input(), fixture.context);

  assert.equal(first.status, "DRAFT_CREATED");
  assert.equal(second.status, "DRAFT_REUSED");
  assert.equal(first.enrollmentId, second.enrollmentId);
  assert.equal(fixture.state.personCreations, 1);
  assert.equal(fixture.state.studentPersonCreations, 1);
  assert.equal(fixture.state.responsibleProfileCreations, 1);
  assert.equal(fixture.state.studentProfileCreations, 1);
  assert.equal(fixture.state.relationshipCreations, 1);
  assert.equal(fixture.state.draftCreations, 1);
});

test("invalid input and unsupported financial fields are rejected before effects", async () => {
  for (const invalid of [
    {},
    { ...input(), enrollment: { startDate: "invalid" } },
    { ...input(), payment: { amount: 100 } },
  ]) {
    const fixture = createFixture();
    await assert.rejects(
      fixture.service.startPreEnrollment(invalid, fixture.context),
      (error) => error.code === PRE_ENROLLMENT_ERROR_CODES.INPUT_INVALID,
    );
    assert.equal(fixture.state.personCalls, 0);
    assert.equal(fixture.state.draftCalls, 0);
  }
});

test("repository or application infrastructure failure is sanitized", async () => {
  const fixture = createFixture({ personFailure: new Error("CPF 52998224725 SQL SELECT") });

  await assert.rejects(
    fixture.service.startPreEnrollment(input(), fixture.context),
    (error) =>
      error.code === PRE_ENROLLMENT_ERROR_CODES.START_FAILED &&
      error.statusCode === 500 &&
      !error.message.includes("52998224725") &&
      error.details === null,
  );
  assert.equal(fixture.state.draftCalls, 0);
});

test("service is fail-closed when authorization is absent or denied", async () => {
  const missingPolicy = createFixture({ authorizeUnit: null });
  await assert.rejects(
    missingPolicy.service.startPreEnrollment(input(), missingPolicy.context),
    (error) => error.code === PRE_ENROLLMENT_ERROR_CODES.CONFIGURATION_INVALID,
  );

  const denied = createFixture({ authorizeUnit: () => false });
  await assert.rejects(
    denied.service.startPreEnrollment(input(), denied.context),
    (error) => error.code === PRE_ENROLLMENT_ERROR_CODES.ACCESS_DENIED,
  );
  assert.equal(denied.state.personCalls, 0);
});

test("simultaneous calls produce only one DRAFT through the atomic boundary", async () => {
  const fixture = createFixture();
  const [left, right] = await Promise.all([
    fixture.service.startPreEnrollment(input(), fixture.context),
    fixture.service.startPreEnrollment(input(), fixture.context),
  ]);

  assert.deepEqual([left.status, right.status].sort(), ["DRAFT_CREATED", "DRAFT_REUSED"]);
  assert.equal(left.enrollmentId, right.enrollmentId);
  assert.equal(fixture.state.draftCreations, 1);
});

test("result and audit logs expose identifiers only, never personal or financial data", async () => {
  const fixture = createFixture();
  const result = await fixture.service.startPreEnrollment(input(), fixture.context);
  const serialized = JSON.stringify({ logs: fixture.state.logs, result });

  assert.doesNotMatch(serialized, /52998224725|responsible@example\.test|11999999999/u);
  assert.doesNotMatch(serialized, /payment|charge|contract|token|stack/u);
  assert.equal(fixture.state.logs[0].context.action, "DRAFT_CREATED");
  assert.equal(fixture.state.logs[0].context.correlationId, "correlation-1");
});

function createFixture(options = {}) {
  const state = {
    activationEffects: [],
    draftCalls: 0,
    draftBoundaryCalls: [],
    draftCreations: 0,
    draftExists: Boolean(options.existingDraft),
    financialEffects: [],
    logs: [],
    personCalls: 0,
    personCreations: 0,
    relationshipCreations: 0,
    relationshipExists: Boolean(options.existingRelationship),
    responsibleExists: Boolean(options.existingPeople),
    responsibleProfileCreations: 0,
    responsibleProfileExists: false,
    studentExists: Boolean(options.existingPeople),
    studentPersonCreations: 0,
    studentProfileCreations: 0,
    studentProfileExists: false,
  };
  const context = Object.freeze({
    correlationId: "correlation-1",
    unitId: "unit-1",
    userId: "user-1",
  });
  const enrollmentBoundary = {
    recordEnrollmentAuditEvent(event) {
      return {
        logPayload: {
          action: event.action,
          actor: event.actor,
          correlationId: event.correlationId,
          enrollmentId: event.enrollmentId,
          studentPersonId: event.studentPersonId,
          studentProfileId: event.studentProfileId,
        },
      };
    },
    async resolveOrCreateDraftEnrollmentForResolvedStudent(inputValue, contextValue) {
      state.draftCalls += 1;
      state.draftBoundaryCalls.push({ context: contextValue, input: inputValue });
      await Promise.resolve();
      if (options.enrollmentError) {
        throw new AppError("Enrollment state blocks pre-enrollment.", {
          code: options.enrollmentError,
          expose: true,
          statusCode: 409,
        });
      }
      if (!state.draftExists) {
        state.draftExists = true;
        state.draftCreations += 1;
        return draftResolution("CREATED", false);
      }
      return draftResolution("FOUND", true);
    },
  };
  const personApplicationService = {
    async resolveOrCreatePerson() {
      state.personCalls += 1;
      if (options.personFailure) throw options.personFailure;
      const reused = state.responsibleExists;
      if (!reused) {
        state.responsibleExists = true;
        state.personCreations += 1;
      }
      return { personId: "responsible-person-1", reused };
    },
  };
  const profileApplicationService = {
    async resolveOrCreateResponsibleProfile() {
      const reused = state.responsibleProfileExists;
      if (!reused) {
        state.responsibleProfileExists = true;
        state.responsibleProfileCreations += 1;
      }
      return { personProfileId: "responsible-profile-1", reused };
    },
  };
  const studentApplicationService = {
    async resolveOrCreateStudent() {
      const personReused = state.studentExists;
      const profileReused = state.studentProfileExists;
      if (!personReused) {
        state.studentExists = true;
        state.studentPersonCreations += 1;
      }
      if (!profileReused) {
        state.studentProfileExists = true;
        state.studentProfileCreations += 1;
      }
      return {
        personId: "student-person-1",
        personProfileId: "student-profile-1",
        reused: { person: personReused, profile: profileReused },
      };
    },
  };
  const relationshipApplicationService = {
    async resolveOrCreateResponsibleStudentRelationship() {
      const reused = state.relationshipExists;
      if (!reused) {
        state.relationshipExists = true;
        state.relationshipCreations += 1;
      }
      return { relationshipId: "relationship-1", reused };
    },
  };
  const logger = {
    info(message, contextValue) {
      state.logs.push({ context: contextValue, level: "info", message });
    },
    warn(message, contextValue) {
      state.logs.push({ context: contextValue, level: "warn", message });
    },
  };
  const authorizeUnit = Object.prototype.hasOwnProperty.call(options, "authorizeUnit")
    ? options.authorizeUnit
    : () => true;
  const service = new PreEnrollmentApplicationService({
    authorizeUnit,
    enrollmentBoundary,
    logger,
    personApplicationService,
    profileApplicationService,
    relationshipApplicationService,
    studentApplicationService,
  });

  return { context, service, state };
}

function input() {
  return {
    enrollment: { startDate: "2026-07-20" },
    responsible: {
      cpf: "52998224725",
      email: "responsible@example.test",
      nome: "Responsavel",
      telefone: "11999999999",
    },
    student: {
      cpf: "11144477735",
      dataNascimento: "2012-03-04",
      nome: "Aluno",
      sexo: "M",
    },
  };
}

function draftResolution(resolution, reused) {
  return {
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    resolution,
    reused,
  };
}
