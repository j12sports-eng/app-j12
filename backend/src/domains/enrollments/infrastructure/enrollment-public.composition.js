const express = require("express");

const {
  ResolveEnrollmentInvitationApplicationService,
} = require("../application/services/resolve-enrollment-invitation-application.service.js");
const {
  applyPublicInvitationResponseHeaders,
  EnrollmentInvitationPublicController,
} = require("../presentation/controllers/enrollment-invitation-public.controller.js");
const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const {
  EnrollmentDigitalInvitationService,
} = require("../application/services/enrollment-digital-invitation.service.js");
const {
  MySqlEnrollmentDigitalInvitationRepository,
} = require("./repositories/mysql-enrollment-digital-invitation.repository.js");
const { MySqlEnrollmentRepository } = require("./repositories/mysql-enrollment.repository.js");

const ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH =
  "/enrollments/digital-invitations/public";
const ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH = "/:token";

function createEnrollmentInvitationPublicComposition(options = {}) {
  const enrollmentRepository =
    options.enrollmentRepository || new MySqlEnrollmentRepository(options.enrollmentRepositoryOptions || {});
  const enrollmentFacade =
    options.enrollmentFacade || new EnrollmentFacade({ enrollmentRepository });
  const invitationRepository =
    options.invitationRepository ||
    new MySqlEnrollmentDigitalInvitationRepository(options.invitationRepositoryOptions || {});
  const invitationResolver =
    options.invitationResolver ||
    new EnrollmentDigitalInvitationService({
      clock: options.clock,
      enrollmentReader: enrollmentFacade,
      invitationRepository,
      logger: options.logger,
    });
  const resolveEnrollmentInvitationService =
    options.resolveEnrollmentInvitationService ||
    new ResolveEnrollmentInvitationApplicationService({
      invitationResolver,
      logger: options.logger,
    });
  const controller =
    options.controller ||
    new EnrollmentInvitationPublicController({
      logger: options.logger,
      resolveEnrollmentInvitationService,
    });

  return Object.freeze({
    controller,
    invitationRepository,
    invitationResolver,
    resolveEnrollmentInvitationService,
    routeBasePath: ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
    routePath: ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH,
  });
}

function createEnrollmentInvitationPublicRouter(options = {}) {
  const router = express.Router();
  const composition = createEnrollmentInvitationPublicComposition(options);

  router.get(
    ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH,
    applyPublicInvitationResponseHeaders,
    composition.controller.getByToken,
  );

  return router;
}

module.exports = {
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH,
  createEnrollmentInvitationPublicComposition,
  createEnrollmentInvitationPublicRouter,
};
