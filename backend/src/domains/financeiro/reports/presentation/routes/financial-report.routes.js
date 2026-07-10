const express = require("express");
const {
  ensureFinancialAdminAccess,
  getAuthModule,
} = require("../../../presentation/routes/financial-admin.routes.js");
const {
  FinancialReportService,
} = require("../../application/services/financial-report.service.js");
const {
  MySqlFinancialReportRepository,
} = require("../../infrastructure/repositories/mysql-financial-report.repository.js");
const { FinancialReportController } = require("../controllers/financial-report.controller.js");

const FINANCIAL_REPORT_ROUTE_BASE_PATH = "/admin/financeiro/relatorios";

function createFinancialReportRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new FinancialReportController({ service: createFinancialReportService(options) });
  router.use(options.authMiddleware || getAuthModule().requireAuth);
  router.use(options.accessMiddleware || ensureFinancialAdminAccess);
  router.get("/", controller.getAll);
  router.get("/financeiro", controller.getFinancial);
  router.get("/mensalidades", controller.getInstallments);
  router.get("/inadimplencia", controller.getDelinquency);
  router.get("/pix", controller.getPix);
  router.get("/automacoes", controller.getAutomations);
  router.get("/export/pdf", controller.exportPdf);
  router.get("/export/xlsx", controller.exportXlsx);
  router.get("/export/csv", controller.exportCsv);
  return router;
}

function createFinancialReportService(options = {}) {
  if (options.service || options.financialReportService)
    return options.service || options.financialReportService;
  const repository =
    options.repository ||
    options.financialReportRepository ||
    new MySqlFinancialReportRepository({ queryRunner: options.queryRunner });
  return new FinancialReportService({ now: options.now, repository });
}

module.exports = {
  FINANCIAL_REPORT_ROUTE_BASE_PATH,
  createFinancialReportRouter,
  createFinancialReportService,
};
