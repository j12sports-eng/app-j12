const express = require("express");

const {
  ChampionshipApplicationService,
  ChampionshipRegistrationService,
} = require("../../application/services/index.js");
const {
  MySqlChampionshipRegistrationRepository,
  MySqlChampionshipRepository,
} = require("../../infrastructure/repositories/index.js");
const {
  CHAMPIONSHIP_ADMIN_ACCESS_POLICY,
  CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH,
} = require("../../shared/constants/index.js");
const {
  ChampionshipAdminController,
  ChampionshipRegistrationController,
} = require("../controllers/index.js");

function createChampionshipAdminRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new ChampionshipAdminController({
      ...options,
      championshipService: options.championshipService || createChampionshipAdminService(options),
    });
  const registrationController =
    options.registrationController ||
    new ChampionshipRegistrationController({
      ...options,
      registrationService:
        options.registrationService || createChampionshipRegistrationService(options),
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureChampionshipAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/inscricoes/equipes-disponiveis", registrationController.findAvailableTeams);
  router.get("/inscricoes/:registrationId", registrationController.findById);
  router.get("/inscricoes", registrationController.findAll);
  router.post("/inscricoes", registrationController.register);
  router.patch("/inscricoes/:registrationId/status", registrationController.updateStatus);
  router.patch("/inscricoes/:registrationId", registrationController.update);
  router.post("/inscricoes/:registrationId/cancelar", registrationController.cancel);
  router.post("/inscricoes/:registrationId/cancel", registrationController.cancel);
  router.delete("/inscricoes/:registrationId", registrationController.cancel);
  router.get("/:championshipId/inscricoes", registrationController.findAll);

  router.get("/", controller.findAll);
  router.get("/:id", controller.findById);
  router.post("/", controller.create);
  router.post("/:id/publish", controller.publish);
  router.post("/:id/archive", controller.archive);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);

  return router;
}

function createChampionshipAdminService(options = {}) {
  if (options.championshipService || options.service) {
    return options.championshipService || options.service;
  }

  const championshipRepository =
    options.championshipRepository ||
    new MySqlChampionshipRepository({
      queryRunner: options.queryRunner || null,
    });

  return new ChampionshipApplicationService({
    championshipRepository,
  });
}

function createChampionshipRegistrationService(options = {}) {
  if (options.registrationService) {
    return options.registrationService;
  }

  const championshipRepository =
    options.championshipRepository ||
    new MySqlChampionshipRepository({
      queryRunner: options.queryRunner || null,
    });
  const registrationRepository =
    options.registrationRepository ||
    options.championshipRegistrationRepository ||
    new MySqlChampionshipRegistrationRepository({
      queryRunner: options.queryRunner || null,
    });

  return new ChampionshipRegistrationService({
    championshipRepository,
    registrationRepository,
  });
}

function ensureChampionshipAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  // Sprint 17.2 mantem canManageSystem como guard ativo; chaves granulares sao metadados.
  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar campeonatos.",
    success: false,
  });
}

ensureChampionshipAdminAccess.accessPolicy = CHAMPIONSHIP_ADMIN_ACCESS_POLICY;

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
  CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH,
  createChampionshipAdminRouter,
  createChampionshipAdminService,
  createChampionshipRegistrationService,
  ensureChampionshipAdminAccess,
  getAuthModule,
};
