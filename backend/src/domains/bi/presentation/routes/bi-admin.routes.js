const express = require("express");
const { BiFoundationService } = require("../../application/index.js");
const { BiFoundationController } = require("../controllers/bi-foundation.controller.js");

const BI_ADMIN_ROUTE_BASE_PATH = "/admin/bi";

function createBiAdminRouter(options = {}) {
  const router = express.Router();
  const service = options.service || new BiFoundationService(options);
  const controller = options.controller || new BiFoundationController({ service });
  router.use(options.authMiddleware || getAuthModule().requireAuth);
  router.use(options.accessMiddleware || ensureBiAdminAccess);
  router.get("/foundation", controller.describe);
  return router;
}

function ensureBiAdminAccess(req, res, next) {
  if (getAuthModule().canManageSystem(req?.auth || req?.user)) return next();
  return res.status(403).json({ success: false, error: "Sem permissao para consultar o BI." });
}

function getAuthModule() {
  return require("../../../../../auth.js");
}

module.exports = { BI_ADMIN_ROUTE_BASE_PATH, createBiAdminRouter, ensureBiAdminAccess };
