const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const {
  EnrollmentInternalController,
} = require("../controllers/enrollment-internal.controller.js");

const ENROLLMENT_INTERNAL_ROUTE_BASE_PATH = "/internal/enrollments";

/**
 * Creates the internal Enrollment router.
 *
 * This factory is intentionally not mounted by this sprint. When a secure
 * internal namespace is approved, mount the returned router under
 * ENROLLMENT_INTERNAL_ROUTE_BASE_PATH.
 *
 * @param {Object} [options]
 * @param {EnrollmentInternalController} [options.controller]
 * @param {Function} [options.authMiddleware]
 * @param {Function} [options.accessMiddleware]
 * @returns {import("express").Router}
 */
function createEnrollmentInternalRouter(options = {}) {
  const router = express.Router();
  const controller = options.controller || new EnrollmentInternalController(options);
  const authMiddleware = options.authMiddleware || requireAuth;
  const accessMiddleware = options.accessMiddleware || ensureInternalEnrollmentAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/status", controller.getStatus);
  router.get("/current-draft", controller.getCurrentDraft);
  router.get("/current-active", controller.getCurrentActive);
  router.post("/:enrollmentId/confirm", controller.confirmDraft);

  return router;
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {unknown}
 */
function ensureInternalEnrollmentAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (canManageSystem(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para acessar a API interna de matriculas.",
    success: false,
  });
}

module.exports = {
  ENROLLMENT_INTERNAL_ROUTE_BASE_PATH,
  createEnrollmentInternalRouter,
  ensureInternalEnrollmentAccess,
};
