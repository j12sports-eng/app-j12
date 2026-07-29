const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");
const {
  MySqlEnrollmentRepository,
} = require("../../infrastructure/repositories/mysql-enrollment.repository.js");
const {
  createEnrollmentActorContextMiddleware,
} = require("../../infrastructure/enrollment-route-context.composition.js");
const { EnrollmentAdminController } = require("../controllers/enrollment-admin.controller.js");

const ENROLLMENT_ADMIN_ROUTE_BASE_PATH = "/admin/enrollments";

/**
 * Creates the administrative Enrollment router.
 *
 * The router is protected with the existing authenticated management pattern:
 * requireAuth + canManageSystem.
 *
 * @param {Object} [options]
 * @param {Function} [options.actorContextMiddleware]
 * @param {EnrollmentAdminController} [options.controller]
 * @param {EnrollmentFacade} [options.enrollmentFacade]
 * @param {Function} [options.authMiddleware]
 * @param {Function} [options.accessMiddleware]
 * @param {Record<string, unknown>} [options.enrollmentRepository]
 * @returns {import("express").Router}
 */
const {
  EnrollmentApplicationService,
} = require("../../application/services/enrollment-application.service.js");
const {
  EnrollmentDigitalInvitationService,
} = require("../../application/services/enrollment-digital-invitation.service.js");
const {
  EnrollmentInvitationAdminApplicationService,
} = require("../../application/services/enrollment-invitation-admin-application.service.js");
const {
  MySqlEnrollmentDigitalInvitationRepository,
} = require("../../infrastructure/repositories/mysql-enrollment-digital-invitation.repository.js");

function createEnrollmentAdminRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new EnrollmentAdminController({
      ...options,
      enrollmentFacade: createEnrollmentAdminFacade(options),
    });
  const authMiddleware = options.authMiddleware || requireAuth;
  const accessMiddleware = options.accessMiddleware || ensureEnrollmentAdminAccess;
  const actorContextMiddleware = createEnrollmentActorContextMiddleware(options);

  router.use(authMiddleware);
  router.use(accessMiddleware);
  router.use(actorContextMiddleware);

  router.post("/:enrollmentId/invitations", controller.createDigitalEnrollmentInvitation);
  router.post("/", controller.openDraft);
  router.get("/students/search", controller.searchStudentScopes);
  router.get("/status", controller.getStatus);
  router.get("/current-draft", controller.getCurrentDraft);
  router.get("/current-active", controller.getCurrentActive);
  router.post("/:enrollmentId/confirm", controller.confirmDraft);

  return router;
}

/**
 * @param {Object} [options]
 * @returns {EnrollmentFacade}
 */
function createEnrollmentAdminFacade(options = {}) {
  if (options.enrollmentFacade || options.facade) {
    return options.enrollmentFacade || options.facade;
  }

  const enrollmentRepository =
    options.enrollmentRepository ||
    new MySqlEnrollmentRepository({
      logger: options.logger || console,
      lockTimeoutSeconds: options.lockTimeoutSeconds,
      queryRunner: options.queryRunner || null,
    });

  const enrollmentApplicationService =
    options.enrollmentService ||
    options.enrollmentApplicationService ||
    new EnrollmentApplicationService({
      enrollmentFactory: options.enrollmentFactory,
      enrollmentRepository,
    });
  const invitationRepository =
    options.invitationRepository ||
    new MySqlEnrollmentDigitalInvitationRepository({
      queryRunner: options.invitationQueryRunner || null,
      transactionRunner: options.invitationTransactionRunner || null,
    });
  const invitationService =
    options.invitationService ||
    new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: async () => true,
      clock: options.invitationClock,
      defaultDurationSeconds: options.defaultInvitationDurationSeconds,
      enrollmentReader: enrollmentApplicationService,
      invitationRepository,
      logger: options.logger,
      tokenGenerator: options.invitationTokenGenerator,
    });
  const enrollmentInvitationAdminService =
    options.enrollmentInvitationAdminService ||
    new EnrollmentInvitationAdminApplicationService({
      clock: options.invitationClock,
      enrollmentReader: enrollmentApplicationService,
      invitationRepository,
      invitationService,
      logger: options.logger,
      publicInvitationBaseUrl: options.publicInvitationBaseUrl,
    });

  return new EnrollmentFacade({
    ...options,
    enrollmentApplicationService,
    enrollmentInvitationAdminService,
    enrollmentRepository,
  });
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {unknown}
 */
function ensureEnrollmentAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (canManageSystem(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar matriculas.",
    success: false,
  });
}

module.exports = {
  ENROLLMENT_ADMIN_ROUTE_BASE_PATH,
  createEnrollmentAdminFacade,
  createEnrollmentAdminRouter,
  ensureEnrollmentAdminAccess,
};
