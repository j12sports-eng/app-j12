const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_ADMIN_ERROR_CODES,
  EnrollmentInvitationAdminApplicationService,
} = require("../services/enrollment-invitation-admin-application.service.js");
const {
  EnrollmentDigitalInvitationService,
  hashRawToken,
} = require("../services/enrollment-digital-invitation.service.js");
const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");

const TOKENS = ["A".repeat(43), "B".repeat(43), "C".repeat(43)];

test("createDigitalEnrollmentInvitation creates a seven-day invitation with a safe response", async () => {
  const fixture = createFixture();
  const result = await fixture.service.createDigitalEnrollmentInvitation(
    { enrollmentId: "draft-1" },
    actorContext(),
  );

  assert.deepEqual(result, {
    expiresAt: "2026-08-05 12:00:00",
    invitationId: result.invitationId,
    status: "ACTIVE",
    url: `/matricula-digital/${TOKENS[0]}`,
  });
  assert.deepEqual(Object.keys(result), ["expiresAt", "invitationId", "status", "url"]);
  const stored = await fixture.repository.findById(result.invitationId);
  assert.equal(stored.tokenHash, hashRawToken(TOKENS[0]));
  assert.equal(JSON.stringify(stored).includes(TOKENS[0]), false);
  assert.equal(stored.createdBy, "identity-1");
  assert.equal(stored.unitId, "12");
});

test("a valid invitation is revoked and reissued without keeping two ACTIVE invitations", async () => {
  const fixture = createFixture();
  const first = await fixture.service.createDigitalEnrollmentInvitation(
    { enrollmentId: "draft-1" },
    actorContext(),
  );
  const second = await fixture.service.createDigitalEnrollmentInvitation(
    { enrollmentId: "draft-1" },
    actorContext(),
  );

  assert.notEqual(first.invitationId, second.invitationId);
  assert.notEqual(first.url, second.url);
  assert.equal((await fixture.repository.findById(first.invitationId)).status, "REVOKED");
  assert.equal((await fixture.repository.findById(second.invitationId)).status, "ACTIVE");
  assert.equal(
    [...fixture.repository.rows.values()].filter((row) => row.status === "ACTIVE").length,
    1,
  );
});

test("an expired invitation is marked EXPIRED before a new token is issued", async () => {
  let now = new Date("2026-07-29T12:00:00.000Z");
  const fixture = createFixture({ clock: () => now });
  const first = await fixture.service.createDigitalEnrollmentInvitation(
    { enrollmentId: "draft-1" },
    actorContext(),
  );
  now = new Date("2026-08-06T12:00:00.000Z");
  const second = await fixture.service.createDigitalEnrollmentInvitation(
    { enrollmentId: "draft-1" },
    actorContext(),
  );

  assert.equal((await fixture.repository.findById(first.invitationId)).status, "EXPIRED");
  assert.equal((await fixture.repository.findById(second.invitationId)).status, "ACTIVE");
});

test("only an owned DRAFT can receive an invitation", async (t) => {
  for (const status of ["ACTIVE", "CANCELLED", "FINISHED"]) {
    await t.test(status, async () => {
      const fixture = createFixture({ status });
      await assert.rejects(
        () =>
          fixture.service.createDigitalEnrollmentInvitation(
            { enrollmentId: "draft-1" },
            actorContext(),
          ),
        { code: ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT, statusCode: 409 },
      );
      assert.equal(fixture.repository.rows.size, 0);
    });
  }
});

test("ownership, canonical unit and ActorContext fail closed", async (t) => {
  const cases = [
    [
      createFixture({ unitId: "13" }),
      actorContext(),
      ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
    ],
    [
      createFixture(),
      actorContext({ unitId: "invalid" }),
      ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN,
    ],
    [createFixture(), {}, ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN],
  ];
  for (const [fixture, actor, code] of cases) {
    await t.test(code, async () => {
      await assert.rejects(
        () => fixture.service.createDigitalEnrollmentInvitation({ enrollmentId: "draft-1" }, actor),
        { code },
      );
      assert.equal(fixture.repository.rows.size, 0);
    });
  }
});

function createFixture({
  clock = () => new Date("2026-07-29T12:00:00.000Z"),
  status = "DRAFT",
  unitId = "12",
} = {}) {
  const repository = new MemoryEnrollmentDigitalInvitationRepository();
  let tokenIndex = 0;
  const enrollmentReader = {
    async findEnrollmentById(id) {
      return id === "draft-1" ? { id, status, unitId } : null;
    },
  };
  const invitationService = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock,
    enrollmentReader,
    invitationRepository: repository,
    tokenGenerator: () => TOKENS[tokenIndex++],
  });
  return {
    repository,
    service: new EnrollmentInvitationAdminApplicationService({
      clock,
      enrollmentReader,
      invitationRepository: repository,
      invitationService,
    }),
  };
}

function actorContext({ unitId = "12" } = {}) {
  return {
    authIdentityId: "identity-1",
    correlationId: "correlation-1",
    membershipRole: "admin",
    requestId: "request-1",
    unitContext: { membershipRole: "admin", unitId },
  };
}
