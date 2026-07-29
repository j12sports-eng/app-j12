const express = require("express");

const {
  EnrollmentDigitalInvitationService,
} = require("../../application/services/enrollment-digital-invitation.service.js");
const {
  EnrollmentPublicApplicationService,
} = require("../../application/services/enrollment-public-application.service.js");
const {
  MySqlEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/mysql-enrollment-digital-invitation.repository.js");
const {
  MySqlEnrollmentRepository,
} = require("../../infrastructure/repositories/mysql-enrollment.repository.js");
const {
  EnrollmentDigitalPublicController,
  applyEnrollmentPublicSecurityHeaders,
} = require("../controllers/enrollment-digital-public.controller.js");

const ENROLLMENT_DIGITAL_PUBLIC_ROUTE_BASE_PATH = "/matricula-digital";
const ENROLLMENT_DIGITAL_PUBLIC_ROUTE_PATH = "/:token";

/**
 * Creates the token-authorized public router. No administrative authentication,
 * ActorContext or client-selected unit is accepted on this boundary.
 */
function createEnrollmentDigitalPublicRouter(options = {}) {
  const router = express.Router();
  const controller = options.controller || createEnrollmentDigitalPublicController(options);

  router.get(
    ENROLLMENT_DIGITAL_PUBLIC_ROUTE_PATH,
    applyEnrollmentPublicSecurityHeaders,
    controller.getByToken,
  );

  return router;
}

function createEnrollmentDigitalPublicController(options = {}) {
  const enrollmentRepository =
    options.enrollmentRepository ||
    new MySqlEnrollmentRepository({
      logger: options.logger || console,
      queryRunner: options.enrollmentQueryRunner || null,
    });
  const invitationRepository =
    options.invitationRepository ||
    new MySqlEnrollmentDigitalInvitationRepository({
      queryRunner: options.invitationQueryRunner || null,
    });
  const invitationService =
    options.invitationService ||
    new EnrollmentDigitalInvitationService({
      clock: options.clock,
      enrollmentReader: enrollmentRepository,
      invitationRepository,
      logger: options.logger,
    });
  const enrollmentPublicApplicationService =
    options.enrollmentPublicApplicationService ||
    new EnrollmentPublicApplicationService({
      enrollmentReader: enrollmentRepository,
      invitationService,
      logger: options.logger,
    });

  return new EnrollmentDigitalPublicController({
    enrollmentPublicApplicationService,
    logger: options.logger,
  });
}

module.exports = {
  ENROLLMENT_DIGITAL_PUBLIC_ROUTE_BASE_PATH,
  ENROLLMENT_DIGITAL_PUBLIC_ROUTE_PATH,
  createEnrollmentDigitalPublicController,
  createEnrollmentDigitalPublicRouter,
};
