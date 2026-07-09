const express = require("express");

const { ChargeService } = require("../../application/services/charge.service.js");
const { PaymentGatewayFactory } = require("../../application/services/payment-gateway.factory.js");
const {
  MySqlPaymentRepository,
} = require("../../infrastructure/repositories/mysql-payment.repository.js");
const { PaymentAdminController } = require("../controllers/payment-admin.controller.js");

const FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH = "/admin/financeiro";

function createFinancialPaymentAdminRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new PaymentAdminController({
      ...options,
      chargeService: createChargeService(options),
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureFinancialPaymentAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.post("/cobrancas", controller.createCharge);
  router.get("/cobrancas", controller.listCharges);
  router.get("/cobrancas/:id", controller.getCharge);
  router.patch("/cobrancas/:id", controller.updateCharge);
  router.delete("/cobrancas/:id", controller.deleteCharge);

  return router;
}

function createChargeService(options = {}) {
  if (options.chargeService) {
    return options.chargeService;
  }

  const repository =
    options.paymentRepository ||
    new MySqlPaymentRepository({
      idGenerator: options.idGenerator,
      queryRunner: options.queryRunner || null,
    });
  const gatewayFactory =
    options.gatewayFactory ||
    new PaymentGatewayFactory({
      providers: options.providers,
    });

  return new ChargeService({
    gatewayFactory,
    repository,
  });
}

function ensureFinancialPaymentAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar cobrancas financeiras.",
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
  FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH,
  createChargeService,
  createFinancialPaymentAdminRouter,
  ensureFinancialPaymentAdminAccess,
  getAuthModule,
};
