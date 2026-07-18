const express = require("express");
const { canManageSystem, requireAuth } = require("../../../../../auth.js");
const {
  CrmLeadEnrollmentConversionController,
} = require("../controllers/crm-lead-enrollment-conversion.controller.js");

const CRM_INTERNAL_ROUTE_BASE_PATH = "/internal/crm";

function createCrmInternalRouter(options = {}) {
  const router = express.Router();

  const controller = options.controller || createCrmLeadEnrollmentConversionController(options);

  const queryController = options.queryController || createCrmLeadQueryController(options);
  const conversionHistoryController =
    options.conversionHistoryController || createCrmLeadConversionHistoryController(options);
  const conversionHistoryExportController =
    options.conversionHistoryExportController ||
    createCrmLeadConversionHistoryExportController(options);
  const pipelineController = options.pipelineController || createCrmPipelineController(options);

  router.use(options.authMiddleware || requireAuth);
  router.use(options.accessMiddleware || ensureCrmInternalAccess);
  router.get("/pipeline", pipelineController.get);
  router.get("/conversions", conversionHistoryController.list);
  router.get("/conversions/export", conversionHistoryExportController.export);
  router.get("/conversions/:conversionId", conversionHistoryController.getById);
  router.get("/leads", queryController.list);
  router.get("/leads/:leadId", queryController.getById);
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
function createCrmLeadEnrollmentConversionController(options = {}) {
  const leadRepository = options.leadRepository || createCrmLeadRepository(options);
  const leadUnitContextService =
    options.leadUnitContextService ||
    createCrmLeadUnitContextService({ ...options, leadRepository });
  const conversionService = createCrmLeadEnrollmentConversionService({
    ...options,
    leadRepository,
  });
  const auditService =
    options.conversionAuditService || createCrmLeadEnrollmentConversionAuditService(options);
  const observedConversionService =
    options.conversionObservabilityService ||
    createCrmLeadEnrollmentConversionObservabilityService({
      ...options,
      auditService,
      conversionService,
    });

  return new CrmLeadEnrollmentConversionController({
    conversionService: observedConversionService,
    leadUnitContextService,
  });
}

function createCrmLeadEnrollmentConversionAuditService(options = {}) {
  const {
    CrmLeadEnrollmentConversionAuditService,
  } = require("../../application/crm-lead-enrollment-conversion-audit.service.js");
  return new CrmLeadEnrollmentConversionAuditService({
    adapter: options.conversionAuditAdapter || options.conversionAuditRepository || null,
    logger: options.logger,
    metrics: options.conversionMetrics,
  });
}

function createCrmLeadEnrollmentConversionObservabilityService(options = {}) {
  const {
    CrmLeadEnrollmentConversionObservabilityDecorator,
  } = require("../../application/crm-lead-enrollment-conversion-observability.decorator.js");
  return new CrmLeadEnrollmentConversionObservabilityDecorator({
    auditService: options.auditService,
    conversionService: options.conversionService,
    logger: options.logger,
    now: options.conversionMonotonicClock,
  });
}

function createCrmLeadQueryController(options = {}) {
  const { CrmLeadQueryController } = require("../controllers/crm-lead-query.controller.js");
  return new CrmLeadQueryController({ queryService: createCrmLeadQueryService(options) });
}

function createCrmLeadQueryService(options = {}) {
  if (options.queryService) return options.queryService;
  const { CrmLeadQueryService } = require("../../application/crm-lead-query.service.js");
  return new CrmLeadQueryService({
    repository:
      options.leadQueryRepository || options.leadRepository || createCrmLeadRepository(options),
  });
}

function createCrmLeadConversionHistoryController(options = {}) {
  const {
    CrmLeadConversionHistoryController,
  } = require("../controllers/crm-lead-conversion-history.controller.js");
  return new CrmLeadConversionHistoryController({
    queryService: createCrmLeadConversionHistoryQueryService(options),
  });
}

function createCrmLeadConversionHistoryQueryService(options = {}) {
  if (options.conversionHistoryQueryService) return options.conversionHistoryQueryService;
  const {
    CrmLeadConversionHistoryQueryService,
  } = require("../../application/crm-lead-conversion-history-query.service.js");
  return new CrmLeadConversionHistoryQueryService({
    repository:
      options.conversionHistoryRepository || createCrmLeadConversionHistoryRepository(options),
  });
}

function createCrmLeadConversionHistoryRepository(options = {}) {
  const {
    MySqlCrmLeadConversionHistoryRepository,
  } = require("../../infrastructure/mysql-crm-lead-conversion-history.repository.js");
  return new MySqlCrmLeadConversionHistoryRepository(options);
}

function createCrmLeadConversionHistoryExportController(options = {}) {
  const {
    CrmLeadConversionHistoryExportController,
  } = require("../controllers/crm-lead-conversion-history-export.controller.js");
  const {
    CrmLeadConversionHistoryExportService,
  } = require("../../application/crm-lead-conversion-history-export.service.js");
  const exportService =
    options.conversionHistoryExportService ||
    new CrmLeadConversionHistoryExportService({
      repository:
        options.conversionHistoryRepository || createCrmLeadConversionHistoryRepository(options),
      logger: options.logger,
    });
  return new CrmLeadConversionHistoryExportController({ exportService });
}

function createCrmPipelineController(options = {}) {
  const { CrmPipelineController } = require("../controllers/crm-pipeline.controller.js");
  const { CrmPipelineService } = require("../../application/crm-pipeline.service.js");
  return new CrmPipelineController({
    pipelineService: options.pipelineService || new CrmPipelineService(),
  });
}

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
  const { MySqlCrmLeadRepository } = require("../../infrastructure/mysql-crm-lead.repository.js");
  const {
    MySqlCrmLeadStudentConversionRepository,
  } = require("../../infrastructure/mysql-crm-lead-student-conversion.repository.js");
  const {
    MySqlCrmLeadEnrollmentConversionRepository,
  } = require("../../infrastructure/mysql-crm-lead-enrollment-conversion.repository.js");

  const authorizeUnit = options.authorizeUnit || ((context, unitId) => context.unitId === unitId);

  const leadStudentConversionService =
    options.leadStudentConversionService ||
    new CrmLeadStudentConversionService({
      authorizeUnit,
      conversionRepository:
        options.studentConversionRepository || new MySqlCrmLeadStudentConversionRepository(options),
      leadRepository: options.leadRepository || new MySqlCrmLeadRepository(options),
      studentApplicationService:
        options.studentApplicationService || new StudentApplicationService(),
    });

  const enrollmentBoundary =
    options.enrollmentBoundary ||
    new EnrollmentFacade({
      enrollmentRepository: options.enrollmentRepository || new MySqlEnrollmentRepository(options),
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

function createCrmLeadRepository(options = {}) {
  const { MySqlCrmLeadRepository } = require("../../infrastructure/mysql-crm-lead.repository.js");
  return new MySqlCrmLeadRepository(options);
}

function createCrmLeadUnitContextService(options = {}) {
  const {
    CrmLeadUnitContextService,
  } = require("../../application/crm-lead-unit-context.service.js");
  return new CrmLeadUnitContextService({ leadRepository: options.leadRepository });
}

function ensureCrmInternalAccess(req, res, next) {
  if (canManageSystem(req.auth || req.user)) {
    // Current policy is global; there is no canonical user-unit claim in the session.
    req.crmAuthorization = Object.freeze({
      granted: true,
      policy: "GLOBAL_SYSTEM_MANAGEMENT",
      scope: "CRM_INTERNAL_MANAGE",
    });
    return next();
  }

  return res.status(403).json({
    code: "CRM_ACCESS_DENIED",
    success: false,
    error: "Sem permissao para converter Leads.",
  });
}

module.exports = {
  CRM_INTERNAL_ROUTE_BASE_PATH,
  createCrmInternalRouter,
  createCrmLeadEnrollmentConversionService,
  createCrmLeadEnrollmentConversionAuditService,
  createCrmLeadEnrollmentConversionObservabilityService,
  createCrmLeadConversionHistoryController,
  createCrmLeadConversionHistoryExportController,
  createCrmLeadConversionHistoryQueryService,
  createCrmLeadConversionHistoryRepository,
  createCrmPipelineController,
  createCrmLeadQueryController,
  createCrmLeadQueryService,
  createCrmLeadUnitContextService,
  ensureCrmInternalAccess,
};
