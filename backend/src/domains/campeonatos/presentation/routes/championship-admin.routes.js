const express = require("express");

const {
  ChampionshipApplicationService,
  ChampionshipBracketService,
  ChampionshipGroupService,
  ChampionshipMatchReportService,
  ChampionshipRegistrationPlayerService,
  ChampionshipRegistrationService,
  ChampionshipRoundService,
  ChampionshipStandingService,
  ChampionshipStatisticsService,
} = require("../../application/services/index.js");
const {
  MySqlChampionshipGroupRepository,
  MySqlChampionshipBracketRepository,
  MySqlChampionshipMatchReportRepository,
  MySqlChampionshipRegistrationPlayerRepository,
  MySqlChampionshipRegistrationRepository,
  MySqlChampionshipRoundRepository,
  MySqlChampionshipRepository,
  MySqlChampionshipStandingRepository,
  MySqlChampionshipStatisticsRepository,
} = require("../../infrastructure/repositories/index.js");
const {
  CHAMPIONSHIP_ADMIN_ACCESS_POLICY,
  CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH,
} = require("../../shared/constants/index.js");
const {
  ChampionshipAdminController,
  ChampionshipBracketController,
  ChampionshipGroupController,
  ChampionshipMatchReportController,
  ChampionshipRegistrationPlayerController,
  ChampionshipRegistrationController,
  ChampionshipRoundController,
  ChampionshipStandingController,
  ChampionshipStatisticsController,
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
  const playerController =
    options.playerController ||
    options.registrationPlayerController ||
    new ChampionshipRegistrationPlayerController({
      ...options,
      playerService: options.playerService || createChampionshipRegistrationPlayerService(options),
    });
  const groupController =
    options.groupController ||
    new ChampionshipGroupController({
      ...options,
      groupService: options.groupService || createChampionshipGroupService(options),
    });
  const standingService = options.standingService || createChampionshipStandingService(options);
  const standingController =
    options.standingController ||
    new ChampionshipStandingController({
      ...options,
      standingService,
    });
  const statisticsService =
    options.statisticsService || createChampionshipStatisticsService(options);
  const statisticsController =
    options.statisticsController ||
    new ChampionshipStatisticsController({
      ...options,
      statisticsService,
    });
  const bracketController =
    options.bracketController ||
    new ChampionshipBracketController({
      ...options,
      bracketService:
        options.bracketService || createChampionshipBracketService({ ...options, standingService }),
    });
  const roundService =
    options.roundService || createChampionshipRoundService({ ...options, standingService });
  const roundController =
    options.roundController ||
    new ChampionshipRoundController({
      ...options,
      roundService,
    });
  const matchReportController =
    options.matchReportController ||
    new ChampionshipMatchReportController({
      ...options,
      matchReportService:
        options.matchReportService ||
        createChampionshipMatchReportService({ ...options, roundService, statisticsService }),
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureChampionshipAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/inscricoes/equipes-disponiveis", registrationController.findAvailableTeams);
  router.get("/inscricoes/:registrationId/atletas", playerController.findAll);
  router.post("/inscricoes/:registrationId/atletas", playerController.create);
  router.get("/inscricoes/:registrationId/atletas/:playerId", playerController.findById);
  router.patch("/inscricoes/:registrationId/atletas/:playerId", playerController.update);
  router.patch(
    "/inscricoes/:registrationId/atletas/:playerId/capitao",
    playerController.setCaptain,
  );
  router.delete("/inscricoes/:registrationId/atletas/:playerId", playerController.delete);
  router.get("/inscricoes/:registrationId", registrationController.findById);
  router.get("/inscricoes", registrationController.findAll);
  router.post("/inscricoes", registrationController.register);
  router.patch("/inscricoes/:registrationId/status", registrationController.updateStatus);
  router.patch("/inscricoes/:registrationId", registrationController.update);
  router.post("/inscricoes/:registrationId/cancelar", registrationController.cancel);
  router.post("/inscricoes/:registrationId/cancel", registrationController.cancel);
  router.delete("/inscricoes/:registrationId", registrationController.cancel);
  router.get("/:championshipId/inscricoes", registrationController.findAll);

  router.get("/:championshipId/grupos", groupController.findAll);
  router.post("/:championshipId/grupos", groupController.create);
  router.post("/:championshipId/grupos/sortear", groupController.draw);
  router.post("/:championshipId/grupos/redistribuir", groupController.redistribute);
  router.get("/:championshipId/grupos/:groupId", groupController.findById);
  router.patch("/:championshipId/grupos/:groupId", groupController.update);
  router.delete("/:championshipId/grupos/:groupId", groupController.remove);
  router.post("/:championshipId/grupos/:groupId/inscricoes", groupController.assignRegistration);
  router.patch(
    "/:championshipId/grupos/:groupId/inscricoes/:registrationId/mover",
    groupController.moveRegistration,
  );
  router.delete(
    "/:championshipId/grupos/:groupId/inscricoes/:registrationId",
    groupController.removeRegistration,
  );

  router.get("/:championshipId/classificacao", standingController.findAll);
  router.post("/:championshipId/classificacao/recalcular", standingController.recalculate);
  router.get("/:championshipId/grupos/:groupId/classificacao", standingController.findByGroup);

  router.get("/:championshipId/estatisticas", statisticsController.findStatistics);
  router.post("/:championshipId/estatisticas/recalcular", statisticsController.recalculate);
  router.get("/:championshipId/rankings", statisticsController.findRankings);
  router.get("/:championshipId/artilharia", statisticsController.findTopScorers);

  router.post("/:championshipId/playoffs/gerar", bracketController.generate);
  router.get("/:championshipId/playoffs", bracketController.findByChampionship);
  router.get("/:championshipId/playoffs/:phase", bracketController.findByPhase);
  router.patch("/playoffs/matches/:matchId", bracketController.updateMatch);
  router.post("/playoffs/matches/:matchId/avancar", bracketController.advanceMatch);
  router.delete("/:championshipId/playoffs", bracketController.deleteByChampionship);

  router.post("/jogos/:matchId/sumula", matchReportController.create);
  router.get("/jogos/:matchId/sumula", matchReportController.findByMatch);
  router.patch("/jogos/:matchId/sumula", matchReportController.update);
  router.post("/jogos/:matchId/sumula/abrir", matchReportController.open);
  router.post("/jogos/:matchId/sumula/eventos", matchReportController.createEvent);
  router.patch("/jogos/:matchId/sumula/eventos/:eventId", matchReportController.updateEvent);
  router.delete("/jogos/:matchId/sumula/eventos/:eventId", matchReportController.deleteEvent);
  router.post("/jogos/:matchId/sumula/finalizar", matchReportController.finalize);
  router.post("/jogos/:matchId/sumula/reabrir", matchReportController.reopen);

  router.get("/:championshipId/rodadas", roundController.findRoundsByChampionship);
  router.post("/:championshipId/rodadas", roundController.createRound);
  router.post("/:championshipId/rodadas/gerar-jogos", roundController.generateMatches);
  router.get("/:championshipId/jogos", roundController.findMatches);
  router.get("/:championshipId/rodadas/:roundId", roundController.findRoundById);
  router.patch("/:championshipId/rodadas/:roundId", roundController.updateRound);
  router.delete("/:championshipId/rodadas/:roundId", roundController.deleteRound);
  router.post("/:championshipId/rodadas/:roundId/jogos", roundController.createMatch);
  router.patch("/:championshipId/jogos/:matchId", roundController.updateMatch);
  router.patch("/:championshipId/jogos/:matchId/mover", roundController.moveMatch);
  router.delete("/:championshipId/jogos/:matchId", roundController.deleteMatch);

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

function createChampionshipRegistrationPlayerService(options = {}) {
  if (options.playerService || options.registrationPlayerService) {
    return options.playerService || options.registrationPlayerService;
  }

  const registrationRepository =
    options.registrationRepository ||
    options.championshipRegistrationRepository ||
    new MySqlChampionshipRegistrationRepository({
      queryRunner: options.queryRunner || null,
    });
  const playerRepository =
    options.playerRepository ||
    options.registrationPlayerRepository ||
    options.championshipRegistrationPlayerRepository ||
    new MySqlChampionshipRegistrationPlayerRepository({
      queryRunner: options.queryRunner || null,
    });

  return new ChampionshipRegistrationPlayerService({
    playerRepository,
    registrationRepository,
  });
}

function createChampionshipGroupService(options = {}) {
  if (options.groupService) {
    return options.groupService;
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
  const groupRepository =
    options.groupRepository ||
    options.championshipGroupRepository ||
    new MySqlChampionshipGroupRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });

  return new ChampionshipGroupService({
    championshipRepository,
    groupRepository,
    registrationRepository,
  });
}

function createChampionshipRoundService(options = {}) {
  if (options.roundService) {
    return options.roundService;
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
  const groupRepository =
    options.groupRepository ||
    options.championshipGroupRepository ||
    new MySqlChampionshipGroupRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });
  const roundRepository =
    options.roundRepository ||
    options.championshipRoundRepository ||
    new MySqlChampionshipRoundRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });

  return new ChampionshipRoundService({
    championshipRepository,
    groupRepository,
    registrationRepository,
    roundRepository,
    standingService: options.standingService || options.championshipStandingService || null,
  });
}

function createChampionshipMatchReportService(options = {}) {
  if (options.matchReportService || options.championshipMatchReportService) {
    return options.matchReportService || options.championshipMatchReportService;
  }

  const matchReportRepository =
    options.matchReportRepository ||
    options.championshipMatchReportRepository ||
    new MySqlChampionshipMatchReportRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });
  const playerRepository =
    options.playerRepository ||
    options.registrationPlayerRepository ||
    options.championshipRegistrationPlayerRepository ||
    new MySqlChampionshipRegistrationPlayerRepository({
      queryRunner: options.queryRunner || null,
    });
  const roundService =
    options.roundService ||
    options.championshipRoundService ||
    createChampionshipRoundService(options);

  return new ChampionshipMatchReportService({
    matchReportRepository,
    playerRepository,
    roundService,
    statisticsService: options.statisticsService || options.championshipStatisticsService || null,
  });
}

function createChampionshipStandingService(options = {}) {
  if (options.standingService) {
    return options.standingService;
  }

  const championshipRepository =
    options.championshipRepository ||
    new MySqlChampionshipRepository({
      queryRunner: options.queryRunner || null,
    });
  const groupRepository =
    options.groupRepository ||
    options.championshipGroupRepository ||
    new MySqlChampionshipGroupRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });
  const roundRepository =
    options.roundRepository ||
    options.championshipRoundRepository ||
    new MySqlChampionshipRoundRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });
  const standingRepository =
    options.standingRepository ||
    options.championshipStandingRepository ||
    new MySqlChampionshipStandingRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });

  return new ChampionshipStandingService({
    championshipRepository,
    groupRepository,
    roundRepository,
    standingRepository,
  });
}

function createChampionshipStatisticsService(options = {}) {
  if (options.statisticsService || options.championshipStatisticsService) {
    return options.statisticsService || options.championshipStatisticsService;
  }

  const championshipRepository =
    options.championshipRepository ||
    new MySqlChampionshipRepository({
      queryRunner: options.queryRunner || null,
    });
  const statisticsRepository =
    options.statisticsRepository ||
    options.championshipStatisticsRepository ||
    new MySqlChampionshipStatisticsRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });

  return new ChampionshipStatisticsService({
    championshipRepository,
    statisticsRepository,
  });
}

function createChampionshipBracketService(options = {}) {
  if (options.bracketService || options.championshipBracketService) {
    return options.bracketService || options.championshipBracketService;
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
  const bracketRepository =
    options.bracketRepository ||
    options.championshipBracketRepository ||
    new MySqlChampionshipBracketRepository({
      queryRunner: options.queryRunner || null,
      transactionRunner: options.transactionRunner || null,
    });

  return new ChampionshipBracketService({
    bracketRepository,
    championshipRepository,
    registrationRepository,
    standingService: options.standingService || options.championshipStandingService || null,
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
  createChampionshipBracketService,
  createChampionshipGroupService,
  createChampionshipMatchReportService,
  createChampionshipRegistrationPlayerService,
  createChampionshipRegistrationService,
  createChampionshipRoundService,
  createChampionshipStandingService,
  createChampionshipStatisticsService,
  ensureChampionshipAdminAccess,
  getAuthModule,
};
