const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MySqlEnrollmentDigitalInvitationRepository,
  SELECT_ACTIVE_INVITATION_BY_ENROLLMENT_AND_UNIT_SQL,
} = require("./mysql-enrollment-digital-invitation.repository.js");

test("findActiveByEnrollmentInUnit scopes the canonical invitation read by enrollment and unit", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentDigitalInvitationRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        {
          enrollment_id: "draft-1",
          expires_at: "2026-08-05 12:00:00",
          id: "invitation-1",
          status: "ACTIVE",
          token_hash: "a".repeat(64),
          unit_id: "12",
        },
      ];
    },
  });

  const result = await repository.findActiveByEnrollmentInUnit({
    enrollmentId: "draft-1",
    unitId: "12",
  });

  assert.equal(calls[0].sql, SELECT_ACTIVE_INVITATION_BY_ENROLLMENT_AND_UNIT_SQL);
  assert.deepEqual(calls[0].params, ["draft-1", "12", "ACTIVE"]);
  assert.equal(result.id, "invitation-1");
  assert.equal(result.unitId, "12");
  assert.match(calls[0].sql, /enrollment_id = \?/u);
  assert.match(calls[0].sql, /unit_id = \?/u);
});

test("findActiveByEnrollmentInUnit rejects a missing unit before SQL", async () => {
  let queried = false;
  const repository = new MySqlEnrollmentDigitalInvitationRepository({
    queryRunner: async () => {
      queried = true;
      return [];
    },
  });
  await assert.rejects(
    () => repository.findActiveByEnrollmentInUnit({ enrollmentId: "draft-1" }),
    /unitId/u,
  );
  assert.equal(queried, false);
});
