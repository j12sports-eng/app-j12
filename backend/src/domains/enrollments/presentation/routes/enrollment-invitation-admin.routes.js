const express = require("express");
const { requireAuth } = require("../../../../../auth.js");
const {
  EnrollmentInvitationAdminAction,
  createEnrollmentInvitationRoleGuardMiddleware,
} = require("../../application/security/enrollment-invitation-role.guard.js");
const {
  EnrollmentInvitationAdminController,
} = require("../controllers/enrollment-invitation-admin.controller.js");

const ENROLLMENT_INVITATION_ADMIN_ROUTE_BASE_PATH = "/admin/enrollments";

function createEnrollmentInvitationAdminRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new EnrollmentInvitationAdminController({
      invitationAdminService: options.invitationAdminService,
      logger: options.logger,
    });
  const authMiddleware = options.authMiddleware || requireAuth;
  const unitContextMiddleware = requiredMiddleware(
    options.unitContextMiddleware,
    "Enrollment invitation admin router requires unitContextMiddleware.",
  );
  const actorContextMiddleware = requiredMiddleware(
    options.actorContextMiddleware,
    "Enrollment invitation admin router requires actorContextMiddleware.",
  );
  const roleGuardFactory =
    options.roleGuardFactory || createEnrollmentInvitationRoleGuardMiddleware;

  const common = [authMiddleware, unitContextMiddleware, actorContextMiddleware];

  router.post(
    "/:enrollmentId/digital-invitations",
    ...common,
    roleGuardFactory(EnrollmentInvitationAdminAction.CREATE_INVITATION),
    controller.create,
  );
  router.post(
    "/:enrollmentId/digital-invitations/renew",
    ...common,
    roleGuardFactory(EnrollmentInvitationAdminAction.RENEW_INVITATION),
    controller.renew,
  );
  router.post(
    "/:enrollmentId/digital-invitations/revoke",
    ...common,
    roleGuardFactory(EnrollmentInvitationAdminAction.REVOKE_INVITATION),
    controller.revoke,
  );
  router.get(
    "/:enrollmentId/digital-invitations/current",
    ...common,
    roleGuardFactory(EnrollmentInvitationAdminAction.VIEW_INVITATION),
    controller.getCurrent,
  );

  return router;
}

function requiredMiddleware(value, message) {
  if (typeof value !== "function") {
    throw new TypeError(message);
  }
  return value;
}

module.exports = {
  ENROLLMENT_INVITATION_ADMIN_ROUTE_BASE_PATH,
  createEnrollmentInvitationAdminRouter,
  requiredMiddleware,
};
