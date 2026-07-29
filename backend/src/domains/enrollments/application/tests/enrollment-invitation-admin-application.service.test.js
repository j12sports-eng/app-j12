const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_ADMIN_ERROR_CODES,
  EnrollmentInvitationAdminApplicationService,
} = require("../services/enrollment-invitation-admin-application.service.js");

const RAW_TOKEN = "A".repeat(43);

test("EnrollmentInvitationAdminApplicationService creates invitation with ActorContext unit only", async () => {
  const logs = [];
  const calls = [];
  const service = createService({
    logger: captureLogger(logs),
    invitationService: {
      createInvitation: async (command, context) => {
        calls.push({ command, context });
        return invitationResult({ rawToken: RAW_TOKEN });
      },
      renewInvitation() {},
      revokeInvitation() {},
    },
  });

  const result = await service.create({ durationSeconds: 600, enrollmentId: "enrollment-1" }, context());

  assert.equal(result.invitation.id, "invitation-1");
  assert.equal(result.invitation.unitId, "12");
  assert.equal(result.rawToken, RAW_TOKEN);
  assert.deepEqual(calls[0], {
    command: { durationSeconds: 600, enrollmentId: "enrollment-1" },
    context: {
      actorId: "identity-1",
      correlationId: "corr-1",
      requestId: "req-1",
      unitId: "12",
    },
  });
  assert.equal(JSON.stringify(logs).includes(RAW_TOKEN), false);
  assert.equal(JSON.stringify(logs).includes("tokenHash"), false);
});

test("EnrollmentInvitationAdminApplicationService rejects client unitId and missing actor contexts", async () => {
  const service = createService();

  await rejectsCode(
    () => service.create({ enrollmentId: "enrollment-1", unitId: "13" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.INPUT_INVALID,
  );
  await rejectsCode(
    () => service.create({ enrollmentId: "enrollment-1" }, {}),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN,
  );
  await rejectsCode(
    () => service.create({ enrollmentId: "enrollment-1" }, { actorContext: { authIdentityId: "identity-1" } }),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN,
  );
});

test("EnrollmentInvitationAdminApplicationService enforces role, DRAFT state and unit ownership", async () => {
  await rejectsCode(
    () => createService().create({ enrollmentId: "enrollment-1" }, context({ membershipRole: "professor" })),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN,
  );
  await rejectsCode(
    () =>
      createService({ enrollment: { id: "enrollment-1", status: "ACTIVE", unitId: "12" } }).create(
        { enrollmentId: "enrollment-1" },
        context(),
      ),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT,
  );
  await rejectsCode(
    () =>
      createService({ enrollment: { id: "enrollment-1", status: "DRAFT", unitId: "13" } }).create(
        { enrollmentId: "enrollment-1" },
        context(),
      ),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({ enrollment: { id: "enrollment-1", status: "DRAFT" } }).create(
        { enrollmentId: "enrollment-1" },
        context(),
      ),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );
  await rejectsCode(
    () => createService({ enrollment: null }).create({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );
});

test("EnrollmentInvitationAdminApplicationService renews, revokes idempotently and reads current safely", async () => {
  const service = createService({
    activeInvitation: invitationRow(),
    invitationService: {
      createInvitation() {},
      renewInvitation: async () => invitationResult({ invitationId: "invitation-2", rawToken: RAW_TOKEN }),
      revokeInvitation: async () => ({ changed: true, invitationId: "invitation-1", status: "REVOKED" }),
    },
  });

  const renewed = await service.renew({ enrollmentId: "enrollment-1" }, context());
  const revoked = await service.revoke({ enrollmentId: "enrollment-1" }, context());
  const current = await service.getCurrent({ enrollmentId: "enrollment-1" }, context());
  const idempotent = await createService({ activeInvitation: null }).revoke(
    { enrollmentId: "enrollment-1" },
    context(),
  );

  assert.equal(renewed.rawToken, RAW_TOKEN);
  assert.equal(revoked.changed, true);
  assert.equal(revoked.invitation.status, "REVOKED");
  assert.equal(current.invitation.id, "invitation-1");
  assert.equal(JSON.stringify(current).includes("rawToken"), false);
  assert.equal(JSON.stringify(current).includes("tokenHash"), false);
  assert.equal(idempotent.changed, false);
  assert.equal(idempotent.invitation, null);
});

test("EnrollmentInvitationAdminApplicationService fails closed on create invitation unit divergence", async () => {
  await rejectsCode(
    () =>
      createService({
        invitationService: {
          createInvitation: async () => invitationResult({ unitId: "13" }),
          renewInvitation() {},
          revokeInvitation() {},
        },
      }).create({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );
});

test("EnrollmentInvitationAdminApplicationService fails closed on invitation unit divergence and sanitized persistence errors", async () => {
  await rejectsCode(
    () =>
      createService({
        invitationService: {
          createInvitation() {},
          renewInvitation: async () => invitationResult({ unitId: "13" }),
          revokeInvitation() {},
        },
      }).renew({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({
        enrollmentReader: {
          findEnrollmentById: async () => {
            throw new Error("db leaked@example.test");
          },
        },
      }).create({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.PERSISTENCE_ERROR,
  );
});

test("EnrollmentInvitationAdminApplicationService revalidates UnitContext when resolver is available", async () => {
  await rejectsCode(
    () =>
      createService({
        unitContextResolver: {
          resolveUnitContext: async () => {
            const error = new Error("revoked");
            error.code = "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE";
            error.statusCode = 403;
            throw error;
          },
        },
      }).create({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.NOT_AVAILABLE,
  );

  await rejectsCode(
    () =>
      createService({
        unitContextResolver: {
          resolveUnitContext: async () => ({
            membershipRole: "professor",
            unitId: "12",
          }),
        },
      }).create({ enrollmentId: "enrollment-1" }, context()),
    ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.FORBIDDEN,
  );
});

test("EnrollmentInvitationAdminApplicationService ignores a client-selected unit during revalidation", async () => {
  const resolverCalls = [];
  const serviceCalls = [];
  const service = createService({
    invitationService: {
      async createInvitation(command, serviceContext) {
        serviceCalls.push({ command, serviceContext });
        return invitationResult({ unitId: "12" });
      },
      renewInvitation() {},
      revokeInvitation() {},
    },
    unitContextResolver: {
      async resolveUnitContext(command) {
        resolverCalls.push(command);
        return {
          membershipRole: "admin",
          unitId: "12",
        };
      },
    },
  });

  await service.create(
    { enrollmentId: "enrollment-1" },
    context({
      unitContext: {
        membershipId: "membership-client-selected",
        membershipRole: "admin",
        unitId: "13",
      },
    }),
  );

  assert.deepEqual(resolverCalls, [
    { authIdentityId: "identity-1", requestedUnitId: null },
  ]);
  assert.equal(serviceCalls[0].serviceContext.unitId, "12");
});

test("EnrollmentInvitationAdminApplicationService handles create races without returning loser token", async () => {
  let created = false;
  const service = createService({
    invitationService: {
      createInvitation: async () => {
        if (created) {
          const error = new Error("duplicate raw should not leak");
          error.code = "ENROLLMENT_INVITATION_ALREADY_ACTIVE";
          throw error;
        }
        created = true;
        return invitationResult({ rawToken: RAW_TOKEN });
      },
      renewInvitation() {},
      revokeInvitation() {},
    },
  });

  const results = await Promise.allSettled([
    service.create({ enrollmentId: "enrollment-1" }, context()),
    service.create({ enrollmentId: "enrollment-1" }, context()),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(fulfilled[0].value.rawToken, RAW_TOKEN);
  assert.equal(rejected[0].reason.code, ENROLLMENT_INVITATION_ADMIN_ERROR_CODES.STATE_CONFLICT);
  assert.equal(JSON.stringify(rejected).includes(RAW_TOKEN), false);
});

function createService(options = {}) {
  const activeInvitation = Object.prototype.hasOwnProperty.call(options, "activeInvitation")
    ? options.activeInvitation
    : invitationRow();

  return new EnrollmentInvitationAdminApplicationService({
    enrollmentReader:
      options.enrollmentReader ||
      {
        findEnrollmentById: async () =>
          Object.prototype.hasOwnProperty.call(options, "enrollment")
            ? options.enrollment
            : { id: "enrollment-1", status: "DRAFT", unitId: "12" },
      },
    invitationRepository:
      options.invitationRepository ||
      {
        findActiveByEnrollment: async () => activeInvitation,
      },
    invitationService:
      options.invitationService ||
      {
        createInvitation: async () => invitationResult({ rawToken: RAW_TOKEN }),
        renewInvitation: async () => invitationResult({ rawToken: RAW_TOKEN }),
        revokeInvitation: async () => ({ changed: true, invitationId: "invitation-1", status: "REVOKED" }),
      },
    logger: options.logger || null,
    unitContextResolver: options.unitContextResolver || null,
  });
}

function context(overrides = {}) {
  return {
    actorContext: {
      authIdentityId: "identity-1",
      correlationId: "corr-1",
      membershipRole: "admin",
      requestId: "req-1",
      unitContext: {
        membershipId: "membership-1",
        membershipRole: "admin",
        unitId: "12",
      },
      ...overrides,
    },
  };
}

function invitationResult(overrides = {}) {
  return {
    createdAt: "2026-07-24 12:00:00",
    enrollmentId: "enrollment-1",
    expiresAt: "2026-07-31 12:00:00",
    invitationId: overrides.invitationId || "invitation-1",
    rawToken: overrides.rawToken || null,
    status: "ACTIVE",
    unitId: overrides.unitId || "12",
  };
}

function invitationRow(overrides = {}) {
  return {
    createdAt: "2026-07-24 12:00:00",
    enrollmentId: "enrollment-1",
    expiresAt: "2026-07-31 12:00:00",
    id: overrides.id || "invitation-1",
    status: overrides.status || "ACTIVE",
    tokenHash: "hidden",
    unitId: overrides.unitId || "12",
  };
}

function captureLogger(records) {
  return {
    info(message, metadata) {
      records.push({ message, metadata });
    },
  };
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    assert.equal(String(error.message).includes("leaked@example.test"), false);
    assert.equal(String(error.stack || "").includes("leaked@example.test"), false);
    return true;
  });
}
