const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_INVITATION_UNIQUE_INDEX,
  MySqlEnrollmentDigitalInvitationRepository,
  SELECT_INVITATION_BY_TOKEN_HASH_SQL,
  INSERT_INVITATION_SQL,
} = require("./mysql-enrollment-digital-invitation.repository.js");

test("MySqlEnrollmentDigitalInvitationRepository uses token hash queries and minimal projections", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentDigitalInvitationRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      if (sql === INSERT_INVITATION_SQL) {
        return [{ affectedRows: 1 }];
      }
      return [
        {
          created_at: "2026-07-24 12:00:00",
          created_by: "actor-1",
          enrollment_id: "enrollment-1",
          expires_at: "2026-07-24 13:00:00",
          id: "inv-1",
          status: "ACTIVE",
          token_hash: "a".repeat(64),
          unit_id: "unit-1",
        },
      ];
    },
  });

  const created = await repository.create({
    createdBy: "actor-1",
    enrollmentId: "enrollment-1",
    expiresAt: "2026-07-24 13:00:00",
    tokenHash: "a".repeat(64),
    unitId: "unit-1",
  });
  const found = await repository.findByTokenHash("a".repeat(64));

  assert.equal(created.id, "inv-1");
  assert.equal(found.id, "inv-1");
  assert.equal(calls[0].sql.includes("token_hash"), true);
  assert.equal(calls[0].sql.includes("rawToken"), false);
  assert.equal(typeof calls[0].params[0], "string");
  assert.match(calls[0].params[0], /^[A-Za-z0-9-]{36}$/);
  assert.deepEqual(calls[0].params.slice(1), [
    "enrollment-1",
    "unit-1",
    "a".repeat(64),
    "ACTIVE",
    "2026-07-24 13:00:00",
    "actor-1",
    null,
  ]);
  assert.equal(calls.some((call) => call.sql === SELECT_INVITATION_BY_TOKEN_HASH_SQL), true);
});

test("MySqlEnrollmentDigitalInvitationRepository revokes, expires and replaces invitations", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentDigitalInvitationRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      if (sql.includes("UPDATE")) {
        return [{ affectedRows: 1 }];
      }
      return [
        {
          created_at: "2026-07-24 12:00:00",
          created_by: "actor-1",
          enrollment_id: "enrollment-1",
          expires_at: "2026-07-24 13:00:00",
          id: "inv-1",
          status: "ACTIVE",
          token_hash: "a".repeat(64),
          unit_id: "unit-1",
        },
      ];
    },
  });

  const revoked = await repository.revokeInvitation({
    invitationId: "inv-1",
    revokedAt: "2026-07-24 12:30:00",
    revokedBy: "actor-1",
  });
  const expired = await repository.expireInvitation({
    expiredAt: "2026-07-24 14:00:00",
    invitationId: "inv-1",
  });

  assert.equal(revoked.changed, true);
  assert.equal(expired.changed, true);
  assert.equal(calls[0].sql.includes("UPDATE"), true);
});

test("MySqlEnrollmentDigitalInvitationRepository surfaces duplicate active index as repository duplicate error", async () => {
  const repository = new MySqlEnrollmentDigitalInvitationRepository({
    async queryRunner(sql) {
      if (sql.includes("INSERT INTO")) {
        const error = new Error(`Duplicate entry for key '${ACTIVE_INVITATION_UNIQUE_INDEX}'`);
        error.code = "ER_DUP_ENTRY";
        error.errno = 1062;
        throw error;
      }

      return [];
    },
  });

  await assert.rejects(
    () =>
      repository.create({
        createdBy: "actor-1",
        enrollmentId: "enrollment-1",
        expiresAt: "2026-07-24 13:00:00",
        tokenHash: "a".repeat(64),
        unitId: "unit-1",
      }),
    { code: "ER_DUP_ENTRY", errno: 1062 },
  );
});
