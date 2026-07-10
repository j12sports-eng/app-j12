const express = require("express");
const {
  BiExecutiveService,
  BiFinancialService,
  BiFoundationService,
} = require("../../application/index.js");
const {
  MySqlBiExecutiveRepository,
} = require("../../infrastructure/repositories/mysql-bi-executive.repository.js");
const {
  MySqlBiFinancialRepository,
} = require("../../infrastructure/repositories/mysql-bi-financial.repository.js");
const { BiExecutiveController } = require("../controllers/bi-executive.controller.js");
const { BiFinancialController } = require("../controllers/bi-financial.controller.js");
const { BiFoundationController } = require("../controllers/bi-foundation.controller.js");

const BI_ADMIN_ROUTE_BASE_PATH = "/admin/bi";

function createBiAdminRouter(options = {}) {
  const router = express.Router();
  const service = options.service || new BiFoundationService(options);
  const controller = options.controller || new BiFoundationController({ service });
  const executiveController =
    options.executiveController ||
    new BiExecutiveController({ service: createBiExecutiveService(options) });
  const financialController =
    options.financialController ||
    new BiFinancialController({ service: createBiFinancialService(options) });
  router.use(options.authMiddleware || getAuthModule().requireAuth);
  router.use(options.accessMiddleware || ensureBiAdminAccess);
  router.get("/foundation", controller.describe);
  router.get("/executive", executiveController.getDashboard);
  router.get("/financial", financialController.getAnalytics);
  return router;
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
  createBiExecutiveService,
  createBiFinancialService,
  ensureBiAdminAccess,
};
