const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const {
  CrmLeadEnrollmentConversionController,
} = require("../controllers/crm-lead-enrollment-conversion.controller.js");

const CRM_INTERNAL_ROUTE_BASE_PATH = "/internal/crm";

function createCrmInternalRouter(options = {}) {
  const router = express.Router();

  const controller =
    options.controller ||
    new CrmLeadEnrollmentConversionController({
      conversionService: createCrmLeadEnrollmentConversionService(options),
    });

  router.use(options.authMiddleware || requireAuth);
  router.use(options.accessMiddleware || ensureCrmInternalAccess);
  router.post("/leads/:leadId/draft-enrollment", controller.convert);

  return router;
}

/**
 * Composition root dos adapters concretos.
 *
 * Os imports de infraestrutura permanecem dentro da factory para evitar
 * carregar configuração, pool ou adapters MySQL durante testes que injetam
 * controller ou conversionService.
 *
 * Nenhuma regra de negócio deve ser adicionada nesta função.
 */
function createCrmLeadEnrollmentConversionService(options = {}) {
  if (options.conversionService) {
    return options.conversionService;
  }

  const {
    StudentApplicationService,
  } = require("../../../pessoas/application/services/student-application.service.js");
  const {
    EnrollmentFacade,
  } = require("../../../enrollments/application/facades/enrollment.facade.js");
  const {
    MySqlEnrollmentRepository,
  } = require("../../../enrollments/infrastructure/repositories/mysql-enrollment.repository.js");
  const {
    CrmLeadEnrollmentConversionService,
  } = require("../../application/crm-lead-enrollment-conversion.service.js");
  const {
    CrmLeadStudentConversionService,
  } = require("../../application/crm-lead-student-conversion.service.js");
  const {
    MySqlCrmLeadRepository,
  } = require("../../infrastructure/mysql-crm-lead.repository.js");
  const {
    MySqlCrmLeadStudentConversionRepository,
  } = require("../../infrastructure/mysql-crm-lead-student-conversion.repository.js");
  const {
    MySqlCrmLeadEnrollmentConversionRepository,
  } = require("../../infrastructure/mysql-crm-lead-enrollment-conversion.repository.js");

  const authorizeUnit =
    options.authorizeUnit ||
    ((context, unitId) => context.unitId === unitId);

  const leadStudentConversionService =
    options.leadStudentConversionService ||
    new CrmLeadStudentConversionService({
      authorizeUnit,
      conversionRepository:
        options.studentConversionRepository ||
        new MySqlCrmLeadStudentConversionRepository(options),
      leadRepository:
options.leadRepository ||
        new MySqlCrmLeadRepository(options),
      studentApplicationService:
        options.studentApplicationService ||
        new StudentApplicationService(),
    });

  const enrollmentBoundary =
    options.enrollmentBoundary ||
    new EnrollmentFacade({
      enrollmentRepository:
        options.enrollmentRepository ||
        new MySqlEnrollmentRepository(options),
    });

  const enrollmentConversionRepository =
    options.enrollmentConversionRepository ||
    new MySqlCrmLeadEnrollmentConversionRepository(options);

  return new CrmLeadEnrollmentConversionService({
    authorizeUnit,
    enrollmentBoundary,
    enrollmentConversionRepository,
    leadStudentConversionService,
  });
}

function ensureCrmInternalAccess(req, res, next) {
  if (canManageSystem(req.auth || req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Sem permissao para converter Leads.",
  });
}

module.exports = {
  CRM_INTERNAL_ROUTE_BASE_PATH,
  createCrmInternalRouter,
  createCrmLeadEnrollmentConversionService,
  ensureCrmInternalAccess,
};