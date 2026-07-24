const {
  UserUnitMembershipRole,
  normalizeUserUnitMembershipRole,
} = require("../../../auth/domain/index.js");

const EnrollmentInvitationAdminAction = Object.freeze({
  CREATE_INVITATION: "CREATE_INVITATION",
  RENEW_INVITATION: "RENEW_INVITATION",
  REVOKE_INVITATION: "REVOKE_INVITATION",
  VIEW_INVITATION: "VIEW_INVITATION",
});

const ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES = Object.freeze({
  FORBIDDEN: "ENROLLMENT_INVITATION_ADMIN_FORBIDDEN",
  INVALID_ACTION: "ENROLLMENT_INVITATION_ADMIN_INVALID_ACTION",
});

const ENROLLMENT_INVITATION_ADMIN_ALLOWED_ROLES = Object.freeze({
  [EnrollmentInvitationAdminAction.CREATE_INVITATION]: Object.freeze([
    UserUnitMembershipRole.ADMIN,
    UserUnitMembershipRole.COORDENADOR,
  ]),
  [EnrollmentInvitationAdminAction.RENEW_INVITATION]: Object.freeze([
    UserUnitMembershipRole.ADMIN,
    UserUnitMembershipRole.COORDENADOR,
  ]),
  [EnrollmentInvitationAdminAction.REVOKE_INVITATION]: Object.freeze([
    UserUnitMembershipRole.ADMIN,
    UserUnitMembershipRole.COORDENADOR,
  ]),
  [EnrollmentInvitationAdminAction.VIEW_INVITATION]: Object.freeze([
    UserUnitMembershipRole.ADMIN,
    UserUnitMembershipRole.COORDENADOR,
  ]),
});

function assertEnrollmentInvitationAdminRole(actorContext, action) {
  const allowedRoles = ENROLLMENT_INVITATION_ADMIN_ALLOWED_ROLES[action];
  if (!allowedRoles) {
    throw roleGuardError(ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES.INVALID_ACTION, 400);
  }

  const role = normalizeUserUnitMembershipRole(actorContext?.membershipRole);
  if (!role || !allowedRoles.includes(role)) {
    throw roleGuardError(ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES.FORBIDDEN, 403);
  }

  return Object.freeze({
    action,
    allowed: true,
    membershipRole: role,
  });
}

function createEnrollmentInvitationRoleGuardMiddleware(action) {
  return function enrollmentInvitationRoleGuard(req, _res, next) {
    try {
      assertEnrollmentInvitationAdminRole(req?.actorContext, action);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function roleGuardError(code, statusCode = 403) {
  const error = new Error("Enrollment invitation admin operation is forbidden.");
  error.code = code;
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

module.exports = {
  ENROLLMENT_INVITATION_ADMIN_ALLOWED_ROLES,
  ENROLLMENT_INVITATION_ROLE_GUARD_ERROR_CODES,
  EnrollmentInvitationAdminAction,
  assertEnrollmentInvitationAdminRole,
  createEnrollmentInvitationRoleGuardMiddleware,
  roleGuardError,
};
