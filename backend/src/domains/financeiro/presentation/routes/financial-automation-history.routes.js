const express = require("express");
const { FinancialAutomationHistoryService } = require("../../application/history/index.js");
const {
  MySqlAutomationExecutionHistoryRepository,
} = require("../../infrastructure/repositories/index.js");
const {
  FinancialAutomationHistoryController,
} = require("../controllers/financial-automation-history.controller.js");
const { ensureFinancialAdminAccess, getAuthModule } = require("./financial-admin.routes.js");

const FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH = "/admin/financeiro/automacoes/historico";

function createFinancialAutomationHistoryRouter(options = {}) {
  const router = express.Router();
  const repository =
    options.repository ||
    options.historyRepository ||
    new MySqlAutomationExecutionHistoryRepository({ queryRunner: options.queryRunner || null });
  const historyService =
    options.historyService || new FinancialAutomationHistoryService({ repository });
  const controller =
    options.controller || new FinancialAutomationHistoryController({ historyService });

  router.use(options.authMiddleware || getAuthModule().requireAuth);
  router.use(options.accessMiddleware || ensureFinancialAdminAccess);
  router.get("/", controller.list);
  // A rota especifica deve preceder /:historyId para evitar conflito no Express.
  router.get("/execution/:executionId", controller.getByExecutionId);
  router.get("/:historyId", controller.getById);
  return router;
}

module.exports = {
  FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH,
  createFinancialAutomationHistoryRouter,
};
