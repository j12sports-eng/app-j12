const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const { PreEnrollmentController } = require("../controllers/pre-enrollment.controller.js");

const PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH = "/internal/pre-enrollments";

function createPreEnrollmentInternalRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new PreEnrollmentController({
      contextResolver: options.contextResolver,
      preEnrollmentService:
        options.preEnrollmentService || createPreEnrollmentApplicationService(options),
    });

  router.use(options.authMiddleware || requireAuth);
  router.use(options.accessMiddleware || ensurePreEnrollmentInternalAccess);
  router.post("/", controller.start);
  return router;
}

function createPreEnrollmentApplicationService(options = {}) {
  const {
    PreEnrollmentApplicationService,
  } = require("../../application/services/pre-enrollment-application.service.js");
  return new PreEnrollmentApplicationService({
    authorizeUnit: options.authorizeUnit || ((context, unitId) => context.unitId === unitId),
    enrollmentBoundary: options.enrollmentBoundary,
    enrollmentRepository: options.enrollmentRepository,
    logger: options.logger,
    personApplicationService: options.personApplicationService,
    profileApplicationService: options.profileApplicationService,
    relationshipApplicationService: options.relationshipApplicationService,
    studentApplicationService: options.studentApplicationService,
  });
}

function ensurePreEnrollmentInternalAccess(req, res, next) {
  if (canManageSystem(req.auth || req.user)) {
    req.preEnrollmentAuthorization = Object.freeze({
      granted: true,
      policy: "SYSTEM_MANAGEMENT_WITH_AUTHENTICATED_UNIT",
      scope: "PRE_ENROLLMENT_INTERNAL_CREATE",
    });
    return next();
  }
  return res.status(403).json({
    code: "PRE_ENROLLMENT_ACCESS_DENIED",
    error: "Sem permissao para iniciar pre-matricula.",
    success: false,
  });
}

module.exports = Object.freeze({
  PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH,
  createPreEnrollmentApplicationService,
  createPreEnrollmentInternalRouter,
  ensurePreEnrollmentInternalAccess,
});
