const express = require("express");
const { EnrollmentFacade } = require("../../../enrollments/application/facades/enrollment.facade.js");
const {
  MySqlEnrollmentRepository,
} = require("../../../enrollments/infrastructure/repositories/mysql-enrollment.repository.js");
const { FinancialFacade } = require("../../application/facades/financial.facade.js");
const {
  MySqlEnrollmentFinancialObligationRepository,
} = require("../../infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js");
const {
  FinancialAdminController,
} = require("../controllers/financial-admin.controller.js");

const FINANCIAL_ADMIN_ROUTE_BASE_PATH = "/admin/financial";

/**
 * Creates the administrative Financeiro router.
 *
 * The router is protected with the existing authenticated management pattern:
 * requireAuth + canManageSystem.
 */
function createFinancialAdminRouter(options = {}) {
  const router = express.Router();
  const controller = options.controller || new FinancialAdminController({
    ...options,
    financialFacade: createFinancialAdminFacade(options),
  });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureFinancialAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/enrollments/:enrollmentId/obligations", controller.listEnrollmentObligations);
  router.get("/students/search", controller.searchStudentScopes);
  router.get("/students/:studentPersonId/:studentProfileId/summary", controller.getStudentSummary);
  router.post("/obligations/:obligationId/mark-paid", controller.markPaid);
  router.post("/obligations/:obligationId/cancel", controller.cancel);
  router.post("/obligations/:obligationId/mark-overdue", controller.markOverdue);

  return router;
}

function createFinancialAdminFacade(options = {}) {
  if (options.financialFacade || options.facade) {
    return options.financialFacade || options.facade;
  }

  const financialObligationRepository =
    options.financialObligationRepository ||
    new MySqlEnrollmentFinancialObligationRepository({
      queryRunner: options.queryRunner || null,
    });
  const studentScopeReader =
    options.studentScopeReader || createFinancialStudentScopeReader(options);

  return new FinancialFacade({
    ...options,
    financialObligationRepository,
    studentScopeReader,
  });
}

function createFinancialStudentScopeReader(options = {}) {
  if (options.enrollmentFacadeForStudentScopes) {
    return options.enrollmentFacadeForStudentScopes;
  }

  const enrollmentRepository =
    options.enrollmentRepository ||
    new MySqlEnrollmentRepository({
      logger: options.logger || console,
      lockTimeoutSeconds: options.lockTimeoutSeconds,
      queryRunner: options.queryRunner || null,
    });

  return new EnrollmentFacade({
    enrollmentRepository,
    eventDispatcher: options.eventDispatcher || undefined,
    logger: options.logger || console,
  });
}

function ensureFinancialAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar financeiro de matriculas.",
    success: false,
  });
}

function getRequireAuth() {
  return getAuthModule().requireAuth;
}

function getCanManageSystem() {
  return getAuthModule().canManageSystem;
}

function getAuthModule() {
  return require("../../../../../auth.js");
}

module.exports = {
  FINANCIAL_ADMIN_ROUTE_BASE_PATH,
  createFinancialStudentScopeReader,
  createFinancialAdminFacade,
  createFinancialAdminRouter,
  ensureFinancialAdminAccess,
  getAuthModule,
};
