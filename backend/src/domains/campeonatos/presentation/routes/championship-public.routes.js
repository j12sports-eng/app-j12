const express = require("express");

const {
  ChampionshipBracketService,
  ChampionshipGroupService,
  ChampionshipPublicService,
  ChampionshipRoundService,
  ChampionshipStandingService,
  ChampionshipStatisticsService,
} = require("../../application/services/index.js");
const {
  MySqlChampionshipBracketRepository,
  MySqlChampionshipGroupRepository,
  MySqlChampionshipPublicRepository,
  MySqlChampionshipRegistrationRepository,
  MySqlChampionshipRepository,
  MySqlChampionshipRoundRepository,
  MySqlChampionshipStatisticsRepository,
} = require("../../infrastructure/repositories/index.js");
const { CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH } = require("../../shared/constants/index.js");
const { ChampionshipPublicController } = require("../controllers/index.js");

function createChampionshipPublicRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new ChampionshipPublicController({
      ...options,
      publicService:
        options.publicService ||
        options.championshipPublicService ||
        createChampionshipPublicService(options),
    });

  router.get("/", controller.findAll);
  router.get("/:championshipId/grupos", controller.findGroups);
  router.get("/:championshipId/equipes", controller.findTeams);
  router.get("/:championshipId/jogos", controller.findMatches);
  router.get("/:championshipId/classificacao", controller.findStandings);
  router.get("/:championshipId/mata-mata", controller.findBracket);
  router.get("/:championshipId/estatisticas", controller.findStatistics);
  router.get("/:championshipId/artilharia", controller.findTopScorers);
  router.get("/:championshipId", controller.findById);

  return router;
}

function createChampionshipPublicService(options = {}) {
  if (options.publicService || options.championshipPublicService || options.service) {
    return options.publicService || options.championshipPublicService || options.service;
  }

  const repositories = createChampionshipPublicRepositories(options);
  const standingService =
    options.standingService ||
    options.championshipStandingService ||
    new ChampionshipStandingService({
      championshipRepository: repositories.championshipRepository,
      groupRepository: repositories.groupRepository,
      roundRepository: repositories.roundRepository,
      standingRepository: createReadonlyStandingRepository(),
    });
  const statisticsService =
    options.statisticsService ||
    options.championshipStatisticsService ||
    new ChampionshipStatisticsService({
      championshipRepository: repositories.championshipRepository,
      statisticsRepository: createReadonlyStatisticsRepository(repositories.statisticsRepository),
    });

  return new ChampionshipPublicService({
    bracketService:
      options.bracketService ||
      options.championshipBracketService ||
      new ChampionshipBracketService({
        bracketRepository: repositories.bracketRepository,
        championshipRepository: repositories.championshipRepository,
        registrationRepository: repositories.registrationRepository,
        standingService,
      }),
    groupService:
      options.groupService ||
      options.championshipGroupService ||
      new ChampionshipGroupService({
        championshipRepository: repositories.championshipRepository,
        groupRepository: repositories.groupRepository,
        registrationRepository: repositories.registrationRepository,
      }),
    publicRepository: repositories.publicRepository,
    roundService:
      options.roundService ||
      options.championshipRoundService ||
      new ChampionshipRoundService({
        championshipRepository: repositories.championshipRepository,
        groupRepository: repositories.groupRepository,
        registrationRepository: repositories.registrationRepository,
        roundRepository: repositories.roundRepository,
        standingService,
      }),
    standingService,
    statisticsService,
  });
}

function createChampionshipPublicRepositories(options = {}) {
  const commonOptions = {
    queryRunner: options.queryRunner || null,
    transactionRunner: options.transactionRunner || null,
  };
  const championshipRepository =
    options.championshipRepository || new MySqlChampionshipRepository(commonOptions);
  const registrationRepository =
    options.registrationRepository ||
    options.championshipRegistrationRepository ||
    new MySqlChampionshipRegistrationRepository(commonOptions);
  const groupRepository =
    options.groupRepository ||
    options.championshipGroupRepository ||
    new MySqlChampionshipGroupRepository(commonOptions);
  const roundRepository =
    options.roundRepository ||
    options.championshipRoundRepository ||
    new MySqlChampionshipRoundRepository(commonOptions);
  const bracketRepository =
    options.bracketRepository ||
    options.championshipBracketRepository ||
    new MySqlChampionshipBracketRepository(commonOptions);
  const statisticsRepository =
    options.statisticsRepository ||
    options.championshipStatisticsRepository ||
    new MySqlChampionshipStatisticsRepository(commonOptions);
  const publicRepository =
    options.publicRepository ||
    options.championshipPublicRepository ||
    new MySqlChampionshipPublicRepository(commonOptions);

  return {
    bracketRepository,
    championshipRepository,
    groupRepository,
    publicRepository,
    registrationRepository,
    roundRepository,
    statisticsRepository,
  };
}

function createReadonlyStandingRepository() {
  return {
    async replaceByChampionship() {
      return null;
    },
  };
}

function createReadonlyStatisticsRepository(repository) {
  return {
    async fetchCalculationData(championshipId) {
      return repository.fetchCalculationData(championshipId);
    },
    async replaceByChampionship() {
      return null;
    },
  };
}

module.exports = {
  CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH,
  createChampionshipPublicRepositories,
  createChampionshipPublicRouter,
  createChampionshipPublicService,
};
