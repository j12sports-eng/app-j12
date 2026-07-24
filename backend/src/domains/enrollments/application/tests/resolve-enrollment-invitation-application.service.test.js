const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentDigitalInvitationService,
} = require("../services/enrollment-digital-invitation.service.js");
const {
  RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  ResolveEnrollmentInvitationApplicationService,
} = require("../services/resolve-enrollment-invitation-application.service.js");
const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");

test("ResolveEnrollmentInvitationApplicationService resolves a valid token with a minimal DTO", async () => {
  const fixture = await createFixture();
  const result = await fixture.publicResolver.resolveByToken({ rawToken: fixture.rawToken });

  assert.deepEqual(result, {
    enrollment: {
      enrollmentId: "enrollment-draft",
      status: "DRAFT",
    },
    enrollmentId: "enrollment-draft",
    expiresAt: "2026-07-24 12:05:00",
    invitationId: fixture.invitationId,
    status: "ACTIVE",
    unitId: "unit-1",
  });
  assert.equal(JSON.stringify(result).includes(fixture.rawToken), false);
  assert.equal(JSON.stringify(result).includes("tokenHash"), false);
});

test("ResolveEnrollmentInvitationApplicationService returns one generic error for invalid invitation states", async (t) => {
  const cases = [
    ["expired token", async () => {
      const fixture = await createFixture();
      fixture.clock.current = new Date("2026-07-25T12:06:00.000Z");
      return fixture;
    }],
    ["revoked token", async () => {
      const fixture = await createFixture();
      await fixture.invitationService.revokeInvitation(
        { invitationId: fixture.invitationId },
        { actorId: "actor-1", unitId: "unit-1" },
      );
      return fixture;
    }],
    ["nonexistent token", async () => {
      const fixture = await createFixture();
      fixture.rawToken = "Z".repeat(43);
      return fixture;
    }],
    ["hash mismatch", async () => {
      const fixture = await createFixture();
      fixture.rawToken = `${fixture.rawToken.slice(0, 42)}Z`;
      return fixture;
    }],
    ["active enrollment", async () => {
      const fixture = await createFixture();
      fixture.enrollmentReader.record.status = "ACTIVE";
      return fixture;
    }],
    ["cancelled enrollment", async () => {
      const fixture = await createFixture();
      fixture.enrollmentReader.record.status = "CANCELLED";
      return fixture;
    }],
    ["finished enrollment", async () => {
      const fixture = await createFixture();
      fixture.enrollmentReader.record.status = "FINISHED";
      return fixture;
    }],
  ];

  for (const [name, build] of cases) {
    await t.test(name, async () => {
      const fixture = await build();

      await assert.rejects(
        () => fixture.publicResolver.resolveByToken({ rawToken: fixture.rawToken }),
        {
          code: RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
          message: "Enrollment invitation is not available.",
          statusCode: 404,
        },
      );
    });
  }
});

test("ResolveEnrollmentInvitationApplicationService rejects malformed tokens before repository lookup", async () => {
  let called = false;
  const publicResolver = new ResolveEnrollmentInvitationApplicationService({
    invitationResolver: {
      async resolveInvitationByRawToken() {
        called = true;
      },
    },
  });

  await assert.rejects(() => publicResolver.resolveByToken({ rawToken: "bad token" }), {
    code: RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  });
  assert.equal(called, false);
});

test("ResolveEnrollmentInvitationApplicationService keeps enumeration responses indistinguishable", async () => {
  const malformed = await resolveFailure("bad token");
  const missing = await resolveFailure("Z".repeat(43));
  const expiredFixture = await createFixture();
  expiredFixture.clock.current = new Date("2026-07-25T12:06:00.000Z");
  const expired = await captureFailure(() =>
    expiredFixture.publicResolver.resolveByToken({ rawToken: expiredFixture.rawToken }),
  );

  assert.deepEqual(malformed, missing);
  assert.deepEqual(missing, expired);
});

async function resolveFailure(rawToken) {
  const fixture = await createFixture();
  return captureFailure(() => fixture.publicResolver.resolveByToken({ rawToken }));
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

async function createFixture() {
  const repository = new MemoryEnrollmentDigitalInvitationRepository();
  const clock = { current: new Date("2026-07-24T12:00:00.000Z") };
  const enrollmentReader = new FakeEnrollmentReader({
    id: "enrollment-draft",
    status: "DRAFT",
    unitId: "unit-1",
  });
  const invitationService = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: () => clock.current,
    enrollmentReader,
    invitationRepository: repository,
    tokenGenerator: () => "A".repeat(43),
  });
  const created = await invitationService.createInvitation(
    { durationSeconds: 300, enrollmentId: "enrollment-draft" },
    { actorId: "actor-1", unitId: "unit-1" },
  );
  const publicResolver = new ResolveEnrollmentInvitationApplicationService({
    invitationResolver: invitationService,
  });

  return {
    clock,
    enrollmentReader,
    invitationId: created.invitationId,
    invitationService,
    publicResolver,
    rawToken: created.rawToken,
  };
}

class FakeEnrollmentReader {
  constructor(record) {
    this.record = { ...record };
  }

  async findEnrollmentById() {
    return { ...this.record };
  }
}
