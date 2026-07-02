const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");
const {
  MySqlEnrollmentRepository,
} = require("../../infrastructure/repositories/mysql-enrollment.repository.js");
const {
  EnrollmentPublicController,
} = require("../controllers/enrollment-public.controller.js");

const ENROLLMENT_PUBLIC_ROUTE_BASE_PATH = "/enrollments";

/**
 * Creates the secured public Enrollment router for frontend consumers.
 *
 * The route is public only as an API boundary. Runtime access stays protected
 * by the existing authenticated management pattern: requireAuth + canManageSystem.
 *
 * @param {Object} [options]
 * @param {EnrollmentPublicController} [options.controller]
 * @param {EnrollmentFacade} [options.enrollmentFacade]
 * @param {Function} [options.authMiddleware]
 * @param {Function} [options.accessMiddleware]
 * @param {Record<string, unknown>} [options.enrollmentRepository]
 * @returns {import("express").Router}
 */
function createEnrollmentPublicRouter(options = {}) {
  const router = express.Router();
  const controller = options.controller || new EnrollmentPublicController({
    ...options,
    enrollmentFacade: createEnrollmentPublicFacade(options),
  });
  const authMiddleware = options.authMiddleware || requireAuth;
  const accessMiddleware = options.accessMiddleware || ensureEnrollmentPublicAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

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
function createEnrollmentPublicFacade(options = {}) {
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

  return new EnrollmentFacade({
    ...options,
    enrollmentRepository,
  });
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {unknown}
 */
function ensureEnrollmentPublicAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (canManageSystem(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para consultar ou confirmar matriculas.",
    success: false,
  });
}

module.exports = {
  ENROLLMENT_PUBLIC_ROUTE_BASE_PATH,
  createEnrollmentPublicFacade,
  createEnrollmentPublicRouter,
  ensureEnrollmentPublicAccess,
};
