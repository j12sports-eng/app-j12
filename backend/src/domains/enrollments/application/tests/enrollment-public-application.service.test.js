const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
  EnrollmentPublicApplicationService,
} = require("../services/enrollment-public-application.service.js");
const {
  EnrollmentDigitalInvitationService,
} = require("../services/enrollment-digital-invitation.service.js");
const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");

test("EnrollmentPublicApplicationService returns only the allowlisted public DTO", async () => {
  const fixture = await createFixture();

  const result = await fixture.publicService.resolveDigitalEnrollmentByToken({
    token: fixture.rawToken,
  });

  assert.deepEqual(result, {
    student: {
      name: "Aluno Publico",
      birthDate: "2014-05-06",
      gender: "M",
    },
    invitation: {
      status: "ACTIVE",
      expiresAt: "2026-07-29 12:05:00",
    },
  });
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    fixture.rawToken,
    "tokenHash",
    "createdBy",
    "actorContext",
    "unitId",
    "enrollmentId",
    "invitationId",
    "studentPersonId",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("EnrollmentPublicApplicationService returns one generic failure for invalid invitation states", async (t) => {
  const cases = [
    [
      "nonexistent token",
      async () => {
        const fixture = await createFixture();
        fixture.rawToken = "Z".repeat(43);
        return fixture;
      },
    ],
    [
      "expired token",
      async () => {
        const fixture = await createFixture();
        fixture.clock.current = new Date("2026-07-30T12:06:00.000Z");
        return fixture;
      },
    ],
    [
      "revoked token",
      async () => {
        const fixture = await createFixture();
        await fixture.repository.revokeInvitation({
          invitationId: fixture.invitationId,
          revokedAt: "2026-07-29 12:01:00",
          revokedBy: "admin-1",
        });
        return fixture;
      },
    ],
    [
      "missing Enrollment",
      async () => {
        const fixture = await createFixture();
        fixture.enrollmentRepository.aggregate = null;
        return fixture;
      },
    ],
  ];

  let expected;
  for (const [name, build] of cases) {
    await t.test(name, async () => {
      const fixture = await build();
      const failure = await captureFailure(() =>
        fixture.publicService.resolveDigitalEnrollmentByToken({ token: fixture.rawToken }),
      );
      expected ||= failure;
      assert.deepEqual(failure, expected);
    });
  }
});

test("EnrollmentPublicApplicationService rejects inconsistent Enrollment ownership", async () => {
  const fixture = await createFixture();
  fixture.enrollmentRepository.publicProjection.unitId = "13";

  await assert.rejects(
    () => fixture.publicService.resolveDigitalEnrollmentByToken({ token: fixture.rawToken }),
    {
      code: ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
      message: "Digital Enrollment invitation is not available.",
      statusCode: 404,
    },
  );
});

test("EnrollmentPublicApplicationService rejects malformed tokens before repository lookup", async () => {
  let invitationCalls = 0;
  const service = new EnrollmentPublicApplicationService({
    invitationService: {
      async resolveInvitationByRawToken() {
        invitationCalls += 1;
      },
    },
  });

  await assert.rejects(() => service.resolveDigitalEnrollmentByToken({ token: "invalid token" }), {
    code: ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
  });
  assert.equal(invitationCalls, 0);
});

async function createFixture() {
  const clock = { current: new Date("2026-07-29T12:00:00.000Z") };
  const enrollmentRepository = new EnrollmentPublicFixtureRepository();
  const repository = new MemoryEnrollmentDigitalInvitationRepository();
  const invitationService = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: () => clock.current,
    enrollmentReader: enrollmentRepository,
    invitationRepository: repository,
    tokenGenerator: () => "A".repeat(43),
  });
  const invitation = await invitationService.createInvitation(
    { durationSeconds: 300, enrollmentId: "draft-1" },
    { actorId: "admin-1", unitId: "12" },
  );
  const publicService = new EnrollmentPublicApplicationService({
    enrollmentReader: enrollmentRepository,
    invitationService,
  });

  return {
    clock,
    enrollmentRepository,
    invitationId: invitation.invitationId,
    invitationService,
    publicService,
    rawToken: invitation.rawToken,
    repository,
  };
}

class EnrollmentPublicFixtureRepository {
  constructor() {
    this.aggregate = { id: "draft-1", status: "DRAFT", unitId: "12" };
    this.publicProjection = {
      enrollmentId: "draft-1",
      status: "DRAFT",
      student: {
        birthDate: "2014-05-06",
        gender: "M",
        name: "Aluno Publico",
      },
      unitId: "12",
    };
  }

  async findById(id) {
    return this.aggregate?.id === id ? { ...this.aggregate } : null;
  }

  async findPublicById({ enrollmentId, unitId }) {
    if (this.publicProjection?.enrollmentId !== enrollmentId || this.aggregate?.unitId !== unitId) {
      return null;
    }
    return structuredClone(this.publicProjection);
  }
}

async function captureFailure(action) {
  try {
    await action();
  } catch (error) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }
  throw new Error("Expected failure.");
}
