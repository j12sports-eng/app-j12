const express = require("express");
const {
  BiClassesService,
  BiChampionshipsService,
  BiCourtsService,
  BiDelinquencyService,
  BiExecutiveService,
  BiExportService,
  BiFinancialService,
  BiFoundationService,
  BiStudentsService,
} = require("../../application/index.js");
const {
  MySqlBiExecutiveRepository,
} = require("../../infrastructure/repositories/mysql-bi-executive.repository.js");
const {
  MySqlBiFinancialRepository,
} = require("../../infrastructure/repositories/mysql-bi-financial.repository.js");
const { BiExecutiveController } = require("../controllers/bi-executive.controller.js");
const { BiExportController } = require("../controllers/bi-export.controller.js");
const { BiClassesController } = require("../controllers/bi-classes.controller.js");
const { BiChampionshipsController } = require("../controllers/bi-championships.controller.js");
const { BiCourtsController } = require("../controllers/bi-courts.controller.js");
const { BiDelinquencyController } = require("../controllers/bi-delinquency.controller.js");
const { BiFinancialController } = require("../controllers/bi-financial.controller.js");
const { BiFoundationController } = require("../controllers/bi-foundation.controller.js");
const { BiStudentsController } = require("../controllers/bi-students.controller.js");
const {
  MySqlBiStudentsRepository,
} = require("../../infrastructure/repositories/mysql-bi-students.repository.js");
const {
  MySqlBiChampionshipsRepository,
} = require("../../infrastructure/repositories/mysql-bi-championships.repository.js");
const {
  MySqlBiClassesRepository,
} = require("../../infrastructure/repositories/mysql-bi-classes.repository.js");
const {
  MySqlBiCourtsRepository,
} = require("../../infrastructure/repositories/mysql-bi-courts.repository.js");
const {
  MySqlBiDelinquencyRepository,
} = require("../../infrastructure/repositories/mysql-bi-delinquency.repository.js");

const BI_ADMIN_ROUTE_BASE_PATH = "/admin/bi";

function createBiAdminRouter(options = {}) {
  const router = express.Router();
  const service = options.service || new BiFoundationService(options);
  const controller = options.controller || new BiFoundationController({ service });
  const executiveController =
    options.executiveController ||
    new BiExecutiveController({ service: createBiExecutiveService(options) });
  const exportController =
    options.exportController || new BiExportController({ service: createBiExportService(options) });
  const financialController =
    options.financialController ||
    new BiFinancialController({ service: createBiFinancialService(options) });
  const studentsController =
    options.studentsController ||
    new BiStudentsController({ service: createBiStudentsService(options) });
  const classesController =
    options.classesController ||
    new BiClassesController({ service: createBiClassesService(options) });
  const championshipsController =
    options.championshipsController ||
    new BiChampionshipsController({ service: createBiChampionshipsService(options) });
  const courtsController =
    options.courtsController || new BiCourtsController({ service: createBiCourtsService(options) });
  const delinquencyController =
    options.delinquencyController ||
    new BiDelinquencyController({ service: createBiDelinquencyService(options) });
  router.use(options.authMiddleware || getAuthModule().requireAuth);
  router.use(options.accessMiddleware || ensureBiAdminAccess);
  router.get("/foundation", controller.describe);
  router.get("/executive", executiveController.getDashboard);
  router.get("/exports/:report/:format", exportController.export);
  router.get("/financial", financialController.getAnalytics);
  router.get("/students", studentsController.getAnalytics);
  router.get("/classes", classesController.getAnalytics);
  router.get("/championships", championshipsController.getAnalytics);
  router.get("/courts", courtsController.getAnalytics);
  router.get("/delinquency", delinquencyController.getAnalytics);
  return router;
}
function createBiExportService(options = {}) {
  if (options.exportService) return options.exportService;
  return new BiExportService({
    maxRows: options.exportMaxRows,
    now: options.now,
    services: {
      championships: createBiChampionshipsService(options),
      classes: createBiClassesService(options),
      courts: createBiCourtsService(options),
      delinquency: createBiDelinquencyService(options),
      executive: createBiExecutiveService(options),
      financial: createBiFinancialService(options),
      students: createBiStudentsService(options),
    },
    timeoutMs: options.exportTimeoutMs,
  });
}
function createBiChampionshipsService(options = {}) {
  if (options.championshipsService) return options.championshipsService;
  const repository =
    options.biChampionshipsRepository ||
    new MySqlBiChampionshipsRepository({ queryRunner: options.queryRunner });
  return new BiChampionshipsService({ now: options.now, repository });
}
function createBiCourtsService(options = {}) {
  if (options.courtsService) return options.courtsService;
  const repository =
    options.biCourtsRepository || new MySqlBiCourtsRepository({ queryRunner: options.queryRunner });
  return new BiCourtsService({ now: options.now, repository });
}

function createBiDelinquencyService(options = {}) {
  if (options.delinquencyService) return options.delinquencyService;
  const repository =
    options.biDelinquencyRepository ||
    new MySqlBiDelinquencyRepository({ queryRunner: options.queryRunner });
  return new BiDelinquencyService({ now: options.now, repository });
}

function createBiClassesService(options = {}) {
  if (options.classesService) return options.classesService;
  const repository =
    options.biClassesRepository ||
    new MySqlBiClassesRepository({ queryRunner: options.queryRunner });
  return new BiClassesService({ now: options.now, repository });
}

function createBiStudentsService(options = {}) {
  if (options.studentsService) return options.studentsService;
  const repository =
    options.biStudentsRepository ||
    new MySqlBiStudentsRepository({ queryRunner: options.queryRunner });
  return new BiStudentsService({ now: options.now, repository });
}

function createBiFinancialService(options = {}) {
  if (options.financialService) return options.financialService;
  const repository =
    options.biFinancialRepository ||
    new MySqlBiFinancialRepository({ queryRunner: options.queryRunner });
  return new BiFinancialService({ now: options.now, repository });
}

function createBiExecutiveService(options = {}) {
  if (options.executiveService) return options.executiveService;
  const repository =
    options.biReadRepository ||
    options.repository ||
    new MySqlBiExecutiveRepository({ queryRunner: options.queryRunner });
  return new BiExecutiveService({ now: options.now, repository });
}

function ensureBiAdminAccess(req, res, next) {
  if (getAuthModule().canManageSystem(req?.auth || req?.user)) return next();
  return res.status(403).json({ success: false, error: "Sem permissao para consultar o BI." });
}

function getAuthModule() {
  return require("../../../../../auth.js");
}

module.exports = {
  BI_ADMIN_ROUTE_BASE_PATH,
  createBiAdminRouter,
  createBiClassesService,
  createBiChampionshipsService,
  createBiCourtsService,
  createBiDelinquencyService,
  createBiExecutiveService,
  createBiExportService,
  createBiFinancialService,
  createBiStudentsService,
  ensureBiAdminAccess,
};
