const {
  toChampionshipBracketPublicDto,
  toChampionshipGroupPublicListResponseDto,
  toChampionshipMatchPublicListResponseDto,
  toChampionshipPublicDto,
  toChampionshipPublicListResponseDto,
  toChampionshipPublicTeamsResponseDto,
  toChampionshipStandingPublicResponseDto,
  toChampionshipStatisticsPublicResponseDto,
  toChampionshipTopScorersPublicResponseDto,
} = require("../dtos/index.js");
const {
  validatePublicChampionshipId,
  validatePublicChampionshipListInput,
  validatePublicPaginationInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const { controlledError } = require("../../shared/utils/index.js");

const CHAMPIONSHIP_PUBLIC_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_PUBLIC_REPOSITORY_REQUIRED";
const CHAMPIONSHIP_PUBLIC_NOT_FOUND_CODE = "CHAMPIONSHIP_PUBLIC_NOT_FOUND";
const CHAMPIONSHIP_PUBLIC_DEPENDENCY_REQUIRED_CODE = "CHAMPIONSHIP_PUBLIC_DEPENDENCY_REQUIRED";

const PUBLIC_REGISTRATION_STATUSES = new Set([RegistrationStatus.CONFIRMED]);

class ChampionshipPublicService {
  constructor(options = {}) {
    this.publicRepository =
      options.publicRepository ||
      options.championshipPublicRepository ||
      options.repository ||
      null;
    this.groupService = options.groupService || options.championshipGroupService || null;
    this.roundService = options.roundService || options.championshipRoundService || null;
    this.standingService = options.standingService || options.championshipStandingService || null;
    this.bracketService = options.bracketService || options.championshipBracketService || null;
    this.statisticsService =
      options.statisticsService || options.championshipStatisticsService || null;
  }

  async findAll(input = {}) {
    const filters = validatePublicChampionshipListInput(input);
    const result = await this.getPublicRepository().findPublishedAll(filters);
    const items = Array.isArray(result?.items) ? result.items : result || [];
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return toChampionshipPublicListResponseDto({
      items,
      limit: filters.limit,
      page: filters.page,
      total,
    });
  }

  async findById(championshipId) {
    const championship = await this.requirePublishedChampionship(championshipId);
    return toChampionshipPublicDto(championship);
  }

  async findGroups(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const result = await this.getGroupService().findAll(id, input);

    return toChampionshipGroupPublicListResponseDto({
      ...result,
      items: sanitizePublicGroups(result?.items || []),
    });
  }

  async findTeams(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    const pagination = validatePublicPaginationInput(input, { defaultLimit: 100 });
    await this.requirePublishedChampionship(id);
    const result = await this.getPublicRepository().findTeamsByChampionship({
      ...pagination,
      championshipId: id,
      search: input.search || input.q || "",
    });
    const items = Array.isArray(result?.items) ? result.items : result || [];
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return toChampionshipPublicTeamsResponseDto({
      items,
      limit: pagination.limit,
      page: pagination.page,
      total,
    });
  }

  async findMatches(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const result = await this.getRoundService().findMatches(id, input);

    return toChampionshipMatchPublicListResponseDto(result);
  }

  async findStandings(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const result = await this.getStandingService().findAll(id, input);

    return toChampionshipStandingPublicResponseDto(result);
  }

  async findBracket(championshipId) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const bracket = await this.getBracketService().findByChampionship(id);

    return toChampionshipBracketPublicDto(bracket);
  }

  async findStatistics(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const result = await this.getStatisticsService().findStatistics(id, input);

    return toChampionshipStatisticsPublicResponseDto(result);
  }

  async findTopScorers(championshipId, input = {}) {
    const id = validatePublicChampionshipId(championshipId);
    await this.requirePublishedChampionship(id);
    const result = await this.getStatisticsService().findTopScorers(id, input);

    return toChampionshipTopScorersPublicResponseDto(result);
  }

  async requirePublishedChampionship(championshipId) {
    const id = validatePublicChampionshipId(championshipId);
    const championship = await this.getPublicRepository().findPublishedById(id);

    if (!championship) {
      throw controlledError(
        "Campeonato publico nao encontrado.",
        CHAMPIONSHIP_PUBLIC_NOT_FOUND_CODE,
        404,
        { championshipId: id },
      );
    }

    return championship;
  }

  getPublicRepository() {
    if (!this.publicRepository) {
      throw controlledError(
        "ChampionshipPublicRepository nao configurado.",
        CHAMPIONSHIP_PUBLIC_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.publicRepository;
  }

  getGroupService() {
    return getRequiredDependency(this.groupService, "ChampionshipGroupService", "findAll");
  }

  getRoundService() {
    return getRequiredDependency(this.roundService, "ChampionshipRoundService", "findMatches");
  }

  getStandingService() {
    return getRequiredDependency(this.standingService, "ChampionshipStandingService", "findAll");
  }

  getBracketService() {
    return getRequiredDependency(
      this.bracketService,
      "ChampionshipBracketService",
      "findByChampionship",
    );
  }

  getStatisticsService() {
    const service = getRequiredDependency(
      this.statisticsService,
      "ChampionshipStatisticsService",
      "findStatistics",
    );

    if (typeof service.findTopScorers !== "function") {
      throw controlledError(
        "ChampionshipStatisticsService publico incompleto.",
        CHAMPIONSHIP_PUBLIC_DEPENDENCY_REQUIRED_CODE,
        500,
        { dependency: "ChampionshipStatisticsService.findTopScorers" },
      );
    }

    return service;
  }
}

function sanitizePublicGroups(groups = []) {
  return groups.map((group) => ({
    ...group,
    registrations: sanitizePublicRegistrations(group?.registrations || []),
  }));
}

function sanitizePublicRegistrations(registrations = []) {
  return registrations.filter((registration) =>
    PUBLIC_REGISTRATION_STATUSES.has(readField(registration, "status")),
  );
}

function getRequiredDependency(service, dependency, methodName) {
  if (!service || typeof service[methodName] !== "function") {
    throw controlledError(
      `${dependency} publico nao configurado.`,
      CHAMPIONSHIP_PUBLIC_DEPENDENCY_REQUIRED_CODE,
      500,
      { dependency, methodName },
    );
  }

  return service;
}

function readField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

module.exports = {
  CHAMPIONSHIP_PUBLIC_DEPENDENCY_REQUIRED_CODE,
  CHAMPIONSHIP_PUBLIC_NOT_FOUND_CODE,
  CHAMPIONSHIP_PUBLIC_REPOSITORY_REQUIRED_CODE,
  ChampionshipPublicService,
};
