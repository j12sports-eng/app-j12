const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES,
  EnrollmentInvitationAdminAction,
  assertEnrollmentInvitationAdminRole,
} = require("./enrollment-invitation-role.guard.js");

test("Enrollment invitation role guard allows only canonical admin unit roles", () => {
  for (const action of Object.values(EnrollmentInvitationAdminAction)) {
    assert.equal(
      assertEnrollmentInvitationAdminRole({ membershipRole: "admin" }, action).allowed,
      true,
    );
    assert.equal(
      assertEnrollmentInvitationAdminRole({ membershipRole: "coordenador" }, action).allowed,
      true,
    );
  }
});

test("Enrollment invitation role guard blocks unsupported or absent membership role", () => {
  for (const membershipRole of ["professor", "responsavel", "aluno", null]) {
    assert.throws(
      () =>
        assertEnrollmentInvitationAdminRole(
          { globalRole: "admin", membershipRole },
          EnrollmentInvitationAdminAction.CREATE_INVITATION,
        ),
      { code: ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES.FORBIDDEN },
    );
  }
});

test("Enrollment invitation role guard ignores body/global role and sanitizes errors", () => {
  assert.throws(
    () =>
      assertEnrollmentInvitationAdminRole(
        { body: { role: "admin" }, globalRole: "admin", membershipRole: "professor" },
        EnrollmentInvitationAdminAction.REVOKE_INVITATION,
      ),
    (error) => {
      assert.equal(error.code, ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES.FORBIDDEN);
      assert.equal(String(error.message).includes("professor"), false);
      assert.equal(String(error.stack || "").includes("professor"), false);
      return true;
    },
  );
});
