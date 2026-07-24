const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE,
  ENROLLMENT_INVITATION_FORBIDDEN_CODE,
  ENROLLMENT_INVITATION_INVALID_INPUT_CODE,
  ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  ENROLLMENT_INVITATION_STATE_CONFLICT_CODE,
  EnrollmentDigitalInvitationService,
  RAW_TOKEN_PATTERN,
  TOKEN_HASH_PATTERN,
} = require("../services/enrollment-digital-invitation.service.js");
const {
  MemoryEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/memory-enrollment-digital-invitation.repository.js");

test("EnrollmentDigitalInvitationService creates a draft invitation with raw token once and persists only tokenHash", async () => {
  const logs = [];
  const service = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: () => new Date("2026-07-24T12:00:00.000Z"),
    enrollmentReader: new FakeEnrollmentReader({
      id: "enrollment-draft",
      status: "DRAFT",
      unitId: "unit-1",
    }),
    invitationRepository: new MemoryEnrollmentDigitalInvitationRepository(),
    logger: {
      info(message, context) {
        logs.push({ context, message });
      },
    },
    tokenGenerator: () => "A".repeat(43),
  });

  const result = await service.createInvitation(
    { durationSeconds: 300, enrollmentId: "enrollment-draft" },
    {
      actorId: "actor-1",
      authorization: { role: "admin" },
      correlationId: "req-1",
      requestId: "req-1",
      unitId: "unit-1",
    },
  );

  assert.equal(result.rawToken, "A".repeat(43));
  assert.match(result.rawToken, RAW_TOKEN_PATTERN);
  assert.match(result.enrollmentId, /^enrollment-draft$/);
  assert.match(result.invitationId, /^[A-Za-z0-9-]{36}$/);
  assert.equal((await service.resolveInvitationByRawToken({ rawToken: result.rawToken })).invitationId, result.invitationId);
  assert.equal("tokenHash" in result, false);
  assert.equal(result.enrollment.status, "DRAFT");
  assert.equal(logs.some((entry) => JSON.stringify(entry).includes("A".repeat(43))), false);
  assert.equal(logs.some((entry) => JSON.stringify(entry).includes("tokenHash")), false);
  assert.match(
    (await service.getInvitationRepository().findById(result.invitationId)).tokenHash,
    TOKEN_HASH_PATTERN,
  );
});

test("EnrollmentDigitalInvitationService rejects invalid command, authorization and state", async (t) => {
  await t.test("missing actor or unit", async () => {
    const service = new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: async () => true,
      enrollmentReader: new FakeEnrollmentReader({ id: "enrollment-draft", status: "DRAFT" }),
      invitationRepository: new MemoryEnrollmentDigitalInvitationRepository(),
    });

    await assert.rejects(
      () => service.createInvitation({ enrollmentId: "enrollment-draft" }, { unitId: "unit-1" }),
      { code: ENROLLMENT_INVITATION_INVALID_INPUT_CODE },
    );
  });

  await t.test("authorization false", async () => {
    const service = new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: async () => false,
      enrollmentReader: new FakeEnrollmentReader({ id: "enrollment-draft", status: "DRAFT" }),
      invitationRepository: new MemoryEnrollmentDigitalInvitationRepository(),
    });

    await assert.rejects(
      () =>
        service.createInvitation(
          { enrollmentId: "enrollment-draft" },
          { actorId: "actor-1", unitId: "unit-1" },
        ),
      { code: ENROLLMENT_INVITATION_FORBIDDEN_CODE },
    );
  });

  await t.test("non draft enrollment", async () => {
    const service = new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: async () => true,
      enrollmentReader: new FakeEnrollmentReader({ id: "enrollment-active", status: "ACTIVE" }),
      invitationRepository: new MemoryEnrollmentDigitalInvitationRepository(),
      tokenGenerator: () => "B".repeat(43),
    });

    await assert.rejects(
      () =>
        service.createInvitation(
          { enrollmentId: "enrollment-active" },
          { actorId: "actor-1", unitId: "unit-1" },
        ),
      { code: ENROLLMENT_INVITATION_STATE_CONFLICT_CODE },
    );
  });

  await t.test("duplicate active", async () => {
    const repository = new MemoryEnrollmentDigitalInvitationRepository();
    const service = new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: async () => true,
      enrollmentReader: new FakeEnrollmentReader({ id: "enrollment-draft", status: "DRAFT" }),
      invitationRepository: repository,
      tokenGenerator: () => "C".repeat(43),
    });

    await service.createInvitation(
      { enrollmentId: "enrollment-draft" },
      { actorId: "actor-1", unitId: "unit-1" },
    );

    await assert.rejects(
      () =>
        service.createInvitation(
          { enrollmentId: "enrollment-draft" },
          { actorId: "actor-1", unitId: "unit-1" },
        ),
      { code: ENROLLMENT_INVITATION_ALREADY_ACTIVE_CODE },
    );
  });
});

test("EnrollmentDigitalInvitationService revokes, renews and resolves tokens safely", async () => {
  const repository = new MemoryEnrollmentDigitalInvitationRepository();
  const reader = new FakeEnrollmentReader({ id: "enrollment-draft", status: "DRAFT", unitId: "unit-1" });
  const service = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: (() => {
      let current = new Date("2026-07-24T12:00:00.000Z");
      return () => new Date(current.getTime());
    })(),
    enrollmentReader: reader,
    invitationRepository: repository,
    tokenGenerator: (() => {
      const queue = ["D".repeat(43), "E".repeat(43)];
      return () => queue.shift();
    })(),
  });

  const created = await service.createInvitation(
    { enrollmentId: "enrollment-draft", durationSeconds: 300 },
    { actorId: "actor-1", unitId: "unit-1" },
  );
  const revoked = await service.revokeInvitation(
    { invitationId: created.invitationId },
    { actorId: "actor-1", unitId: "unit-1" },
  );

  assert.equal(revoked.changed, true);
  await assert.rejects(
    () => service.resolveInvitationByRawToken({ rawToken: created.rawToken }),
    { code: ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE },
  );

  const renewed = await service.renewInvitation(
    { enrollmentId: "enrollment-draft", durationSeconds: 300 },
    { actorId: "actor-1", unitId: "unit-1" },
  );

  assert.notEqual(renewed.rawToken, created.rawToken);
  assert.equal((await service.resolveInvitationByRawToken({ rawToken: renewed.rawToken })).invitationId, renewed.invitationId);
  reader.record.status = "ACTIVE";
  await assert.rejects(
    () => service.resolveInvitationByRawToken({ rawToken: renewed.rawToken }),
    { code: ENROLLMENT_INVITATION_STATE_CONFLICT_CODE },
  );
});

test("EnrollmentDigitalInvitationService rejects malformed tokens before repository lookup and expires stale tokens", async () => {
  let repositoryLookups = 0;
  const service = new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: async () => true,
    clock: () => new Date("2026-07-24T12:00:00.000Z"),
    enrollmentReader: new FakeEnrollmentReader({ id: "enrollment-expire", status: "DRAFT" }),
    invitationRepository: {
      async create(input) {
        return {
          ...input,
          createdAt: "2026-07-24 12:00:00",
          id: "inv-1",
          status: "ACTIVE",
        };
      },
      async expireInvitation() {
        return { changed: true, invitation: { status: "EXPIRED" } };
      },
      async findActiveByEnrollment() {
        return null;
      },
      async findById() {
        return null;
      },
      async findByTokenHash() {
        repositoryLookups += 1;
        return null;
      },
    },
    tokenGenerator: () => "F".repeat(43),
  });

  await assert.rejects(() => service.resolveInvitationByRawToken({ rawToken: "bad token" }), {
    code: ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  });
  assert.equal(repositoryLookups, 0);

  const invitation = await service.createInvitation(
    { enrollmentId: "enrollment-expire", durationSeconds: 300 },
    { actorId: "actor-1", unitId: "unit-1" },
  );
  service.clock = () => new Date("2026-07-24T12:06:00.000Z");

  await assert.rejects(() => service.resolveInvitationByRawToken({ rawToken: invitation.rawToken }), {
    code: ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  });
});

class FakeEnrollmentReader {
  constructor(record = null) {
    this.record = record ? { ...record } : null;
  }

  async findEnrollmentById() {
    return this.record ? { ...this.record } : null;
  }
}
