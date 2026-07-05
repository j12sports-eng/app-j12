const express = require("express");

const { CourtRentalController } = require("../controllers/court-rental.controller.js");

const COURT_RENTAL_ROUTE_BASE_PATH = "/admin/quadras";

function createCourtRentalRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new CourtRentalController({
      ...options,
      service: options.service,
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureCourtRentalAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/", controller.listCourts);
  router.post("/", controller.createCourt);

  router.get("/locatarios", controller.listRenters);
  router.post("/locatarios", controller.createRenter);

  router.get("/reservas", controller.listReservations);
  router.post("/reservas", controller.createReservation);
  router.post("/reservas/cotacao", controller.calculateQuote);
  router.patch("/reservas/:reservationId", controller.updateReservation);
  router.post("/reservas/:reservationId/duplicar", controller.duplicateReservation);
  router.patch("/reservas/:reservationId/pagamento", controller.confirmReservationPayment);
  router.patch("/reservas/:reservationId/reagendar", controller.rescheduleReservation);
  router.delete("/reservas/:reservationId/cancelar", controller.cancelReservation);

  router.get("/disponibilidade", controller.getAvailability);
  router.post("/disponibilidade/validar", controller.validateAvailability);

  router.get("/bloqueios", controller.listBlocks);
  router.post("/bloqueios", controller.createBlock);
  router.patch("/bloqueios/:blockId", controller.updateBlock);
  router.delete("/bloqueios/:blockId", controller.cancelBlock);

  router.get("/lista-espera", controller.listWaitlist);
  router.post("/lista-espera", controller.addToWaitlist);
  router.post("/lista-espera/:waitlistId/promover", controller.promoteWaitlistEntry);

  router.get("/relatorios", controller.getReports);
  router.get("/relatorios/exportar", controller.exportReports);
  router.get("/auditoria", controller.listAudit);

  router.get("/:courtId", controller.getCourt);
  router.put("/:courtId", controller.updateCourt);
  router.get("/:courtId/precos", controller.listPriceRules);
  router.post("/:courtId/precos", controller.upsertPriceRule);

  return router;
}

function ensureCourtRentalAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar locacao de quadras.",
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
  COURT_RENTAL_ROUTE_BASE_PATH,
  createCourtRentalRouter,
  ensureCourtRentalAdminAccess,
  getAuthModule,
};
