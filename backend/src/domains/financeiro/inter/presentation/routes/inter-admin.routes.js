const express = require("express");

const { InterAdminController } = require("../controllers/inter-admin.controller.js");

const FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH = "/admin/financeiro/inter";

function createFinancialInterAdminRouter(options = {}) {
  const router = express.Router();
  const controller = options.controller || new InterAdminController(options);
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureFinancialInterAdminAccess;

  router.post("/webhook", controller.webhook);

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.post("/pix", controller.createPix);
  router.get("/pix/:txid", controller.getPix);
  router.delete("/pix/:txid", controller.cancelPix);
  router.post("/cobrancas", controller.createCharge);
  router.get("/cobrancas/:id", controller.getCharge);
  router.post("/sincronizar", controller.sync);

  return router;
}

function ensureFinancialInterAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar integracao Banco Inter.",
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
  return require("../../../../../../auth.js");
}

module.exports = {
  FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH,
  createFinancialInterAdminRouter,
  ensureFinancialInterAdminAccess,
  getAuthModule,
};
