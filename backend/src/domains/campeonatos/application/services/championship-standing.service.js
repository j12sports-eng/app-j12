const { toChampionshipStandingAdminResponseDto } = require("../dtos/index.js");
const {
  validateChampionshipStandingGroupInput,
  validateChampionshipStandingListInput,
  validateRecalculateChampionshipStandingsInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const {
  CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
  ChampionshipMatchStatus,
  ChampionshipRoundPhase,
  ChampionshipStandingTieBreaker,
} = require("../../shared/constants/index.js");
const { controlledError } = require("../../shared/utils/index.js");

const STANDING_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_STANDING_REPOSITORY_REQUIRED";
const STANDING_GROUP_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_STANDING_GROUP_REPOSITORY_REQUIRED";
const STANDING_ROUND_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_STANDING_ROUND_REPOSITORY_REQUIRED";
const STANDING_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_STANDING_CHAMPIONSHIP_REPOSITORY_REQUIRED";
const STANDING_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_STANDING_CHAMPIONSHIP_NOT_FOUND";
const STANDING_GROUP_NOT_FOUND_CODE = "CHAMPIONSHIP_STANDING_GROUP_NOT_FOUND";

const ACTIVE_REGISTRATION_STATUSES = new Set([
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING,
]);

class ChampionshipStandingService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || null;
    this.groupRepository = options.groupRepository || options.championshipGroupRepository || null;
    this.roundRepository = options.roundRepository || options.championshipRoundRepository || null;
    this.standingRepository =
      options.standingRepository ||
      options.championshipStandingRepository ||
      options.repository ||
      null;
  }

  async findAll(championshipId, input = {}) {
    const filters = validateChampionshipStandingListInput(championshipId, input);
    await this.requireChampionship(filters.championshipId);

    if (filters.groupId) {
      await this.requireGroup(filters.championshipId, filters.groupId);
    }

    const calculated = await this.calculateAndPersist(filters.championshipId, filters.criteria);
    const items = filters.groupId
      ? calculated.items.filter((item) => readStandingField(item, "groupId") === filters.groupId)
      : this.toGeneralItems(calculated.items, filters.criteria);

    return this.buildResponse(items, {
      calculatedAt: calculated.calculatedAt,
      criteria: filters.criteria,
      groups: filters.groupId ? [] : calculated.groups,
      limit: filters.limit,
      page: filters.page,
    });
  }

  async findByGroup(championshipId, groupId, input = {}) {
    const filters = validateChampionshipStandingGroupInput(championshipId, groupId, input);
    await this.requireChampionship(filters.championshipId);
    await this.requireGroup(filters.championshipId, filters.groupId);

    const calculated = await this.calculateAndPersist(filters.championshipId, filters.criteria);
    const items = calculated.items
      .filter((item) => readStandingField(item, "groupId") === filters.groupId)
      .map((item) => ({
        ...readStandingJson(item),
        position: readStandingField(item, "groupPosition"),
      }));

    return this.buildResponse(items, {
      calculatedAt: calculated.calculatedAt,
      criteria: filters.criteria,
      groups: [],
      limit: filters.limit,
      page: filters.page,
    });
  }

  async recalculate(championshipId, input = {}) {
    const values = validateRecalculateChampionshipStandingsInput(championshipId, input);
    await this.requireChampionship(values.championshipId);

    const calculated = await this.calculateAndPersist(values.championshipId, values.criteria);
    const items = this.toGeneralItems(calculated.items, values.criteria);

    return this.buildResponse(items, {
      calculatedAt: calculated.calculatedAt,
      criteria: values.criteria,
      groups: calculated.groups,
      limit: 500,
      page: 1,
    });
  }

  async calculateAndPersist(championshipId, criteria = CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS) {
    const calculatedAt = toSqlDateTime(new Date());
    const groups = await this.fetchGroups(championshipId);
    const matches = await this.fetchGroupStageMatches(championshipId);
    const standings = this.seedStandings(championshipId, groups, criteria, calculatedAt);

    for (const match of matches) {
      if (!isMatchEligibleForStanding(match)) continue;
      this.applyMatchResult(standings, groups, match, criteria, calculatedAt);
    }

    const orderedItems = this.assignPositions(standings, groups, criteria, calculatedAt);
    await this.getStandingRepository().replaceByChampionship(championshipId, orderedItems);

    return {
      calculatedAt,
      criteria,
      groups: this.groupItems(orderedItems),
      items: orderedItems,
    };
  }

  seedStandings(championshipId, groups = [], criteria = [], calculatedAt = null) {
    const standings = new Map();

    for (const group of groups) {
      for (const registration of readGroupRegistrations(group)) {
        if (!ACTIVE_REGISTRATION_STATUSES.has(readRegistrationField(registration, "status"))) {
          continue;
        }

        const standing = createStandingSeed({
          calculatedAt,
          championshipId,
          criteria,
          group,
          registration,
        });
        standings.set(createStandingKey(standing.groupId, standing.registrationId), standing);
      }
    }

    return standings;
  }

  applyMatchResult(standings, groups, match, criteria, calculatedAt) {
    const home = this.ensureStandingForMatchSide(
      standings,
      groups,
      match,
      "home",
      criteria,
      calculatedAt,
    );
    const away = this.ensureStandingForMatchSide(
      standings,
      groups,
      match,
      "away",
      criteria,
      calculatedAt,
    );
    const homeScore = Number(readMatchField(match, "homeScore"));
    const awayScore = Number(readMatchField(match, "awayScore"));

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (homeScore > awayScore) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
      return;
    }

    if (homeScore < awayScore) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
      return;
    }

    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }

  ensureStandingForMatchSide(standings, groups, match, side, criteria, calculatedAt) {
    const registrationId = readMatchField(match, `${side}RegistrationId`);
    const groupId = readMatchField(match, "groupId");
    const key = createStandingKey(groupId, registrationId);
    const existing = standings.get(key);

    if (existing) return existing;

    const group =
      groups.find((item) => readGroupField(item, "id") === groupId) ||
      createGroupFallback(match, groupId);
    const standing = createStandingSeed({
      calculatedAt,
      championshipId: readMatchField(match, "championshipId"),
      criteria,
      group,
      registration: createRegistrationFallback(match, side, groupId, registrationId),
    });

    standings.set(key, standing);
    return standing;
  }

  assignPositions(standings, groups, criteria, calculatedAt) {
    const groupOrder = new Map(
      groups.map((group) => [
        readGroupField(group, "id"),
        Number(readGroupField(group, "displayOrder") || 0),
      ]),
    );
    const grouped = new Map();

    for (const standing of standings.values()) {
      const list = grouped.get(standing.groupId) || [];
      list.push(standing);
      grouped.set(standing.groupId, list);
    }

    const orderedGroups = Array.from(grouped.entries()).sort(
      ([leftId], [rightId]) =>
        Number(groupOrder.get(leftId) || 0) - Number(groupOrder.get(rightId) || 0) ||
        String(leftId || "").localeCompare(String(rightId || "")),
    );
    const orderedItems = [];

    for (const [, items] of orderedGroups) {
      const groupItems = items
        .slice()
        .sort((left, right) => compareStandings(left, right, criteria));
      groupItems.forEach((item, index) => {
        item.groupPosition = index + 1;
        item.position = index + 1;
        item.calculatedAt = calculatedAt;
        item.tieBreakers = criteria;
        orderedItems.push(item);
      });
    }

    const overallItems = orderedItems
      .slice()
      .sort((left, right) => compareStandings(left, right, criteria));

    overallItems.forEach((item, index) => {
      item.overallPosition = index + 1;
    });

    return orderedItems;
  }

  toGeneralItems(items = [], criteria = []) {
    return items
      .slice()
      .sort((left, right) => compareStandings(left, right, criteria))
      .map((item, index) => ({
        ...readStandingJson(item),
        overallPosition: index + 1,
        position: index + 1,
      }));
  }

  buildResponse(items = [], options = {}) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 100);
    const total = items.length;
    const start = (page - 1) * limit;
    const pagedItems = items.slice(start, start + limit);

    return toChampionshipStandingAdminResponseDto({
      calculatedAt: options.calculatedAt,
      criteria: options.criteria,
      groups: options.groups || [],
      items: pagedItems,
      limit,
      page,
      total,
    });
  }

  groupItems(items = []) {
    const groups = new Map();

    for (const item of items) {
      const groupId = readStandingField(item, "groupId");
      const current = groups.get(groupId) || {
        groupDisplayOrder: readStandingField(item, "groupDisplayOrder"),
        groupId,
        groupName: readStandingField(item, "groupName"),
        items: [],
      };
      current.items.push({
        ...readStandingJson(item),
        position: readStandingField(item, "groupPosition"),
      });
      groups.set(groupId, current);
    }

    return Array.from(groups.values()).sort(
      (left, right) =>
        Number(left.groupDisplayOrder || 0) - Number(right.groupDisplayOrder || 0) ||
        String(left.groupName || "").localeCompare(String(right.groupName || "")),
    );
  }

  async fetchGroups(championshipId) {
    const repository = this.getGroupRepository();
    const items = [];
    let page = 1;
    const limit = 100;

    while (page <= 20) {
      const result = await repository.findAllByChampionship({
        championshipId,
        limit,
        page,
        sortBy: "displayOrder",
        sortDirection: "ASC",
      });
      const pageItems = Array.isArray(result?.items) ? result.items : result || [];
      items.push(...pageItems);

      const total = Number(result?.total || pageItems.length);
      if (page * limit >= total || pageItems.length === 0) break;
      page += 1;
    }

    return items;
  }

  async fetchGroupStageMatches(championshipId) {
    const repository = this.getRoundRepository();
    const items = [];
    let page = 1;
    const limit = 500;

    while (page <= 20) {
      const result = await repository.findMatches({
        championshipId,
        limit,
        page,
        phase: ChampionshipRoundPhase.GROUP_STAGE,
        sortBy: "roundNumber",
        sortDirection: "ASC",
      });
      const pageItems = Array.isArray(result?.items) ? result.items : result || [];
      items.push(...pageItems);

      const total = Number(result?.total || pageItems.length);
      if (page * limit >= total || pageItems.length === 0) break;
      page += 1;
    }

    return items;
  }

  async requireChampionship(championshipId) {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado para classificacao.",
        STANDING_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    const championship = await this.championshipRepository.findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado para classificacao.",
        STANDING_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  async requireGroup(championshipId, groupId) {
    const group = await this.getGroupRepository().findById(championshipId, groupId);

    if (!group) {
      throw controlledError(
        "Grupo nao encontrado para classificacao.",
        STANDING_GROUP_NOT_FOUND_CODE,
        404,
        {
          championshipId,
          groupId,
        },
      );
    }

    return group;
  }

  getStandingRepository() {
    if (!this.standingRepository) {
      throw controlledError(
        "ChampionshipStandingRepository nao configurado.",
        STANDING_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.standingRepository;
  }

  getGroupRepository() {
    if (!this.groupRepository) {
      throw controlledError(
        "ChampionshipGroupRepository nao configurado para classificacao.",
        STANDING_GROUP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.groupRepository;
  }

  getRoundRepository() {
    if (!this.roundRepository) {
      throw controlledError(
        "ChampionshipRoundRepository nao configurado para classificacao.",
        STANDING_ROUND_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.roundRepository;
  }
}

function createStandingSeed({ calculatedAt, championshipId, criteria, group, registration }) {
  return {
    calculatedAt,
    championshipId,
    draws: 0,
    goalDifference: 0,
    goalsAgainst: 0,
    goalsFor: 0,
    groupDisplayOrder: Number(readGroupField(group, "displayOrder") || 0),
    groupId: readGroupField(group, "id"),
    groupName: readGroupField(group, "name"),
    groupPosition: 0,
    losses: 0,
    overallPosition: 0,
    played: 0,
    points: 0,
    position: 0,
    registrationId: readRegistrationField(registration, "registrationId"),
    teamAcronym: readRegistrationField(registration, "teamAcronym"),
    teamId: readRegistrationField(registration, "teamId"),
    teamName: readRegistrationField(registration, "teamName"),
    tieBreakers: criteria,
    wins: 0,
  };
}

function compareStandings(left, right, criteria = []) {
  const safeCriteria = criteria.length > 0 ? criteria : CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS;

  for (const criterion of safeCriteria) {
    const result = compareByCriterion(left, right, criterion);
    if (result !== 0) return result;
  }

  return (
    String(readStandingField(left, "teamName") || "").localeCompare(
      String(readStandingField(right, "teamName") || ""),
    ) ||
    String(readStandingField(left, "registrationId") || "").localeCompare(
      String(readStandingField(right, "registrationId") || ""),
    )
  );
}

function compareByCriterion(left, right, criterion) {
  if (criterion === ChampionshipStandingTieBreaker.TEAM_NAME) {
    return String(readStandingField(left, "teamName") || "").localeCompare(
      String(readStandingField(right, "teamName") || ""),
    );
  }

  const leftValue = Number(readStandingField(left, criterion) || 0);
  const rightValue = Number(readStandingField(right, criterion) || 0);

  if (
    criterion === ChampionshipStandingTieBreaker.GOALS_AGAINST ||
    criterion === ChampionshipStandingTieBreaker.LOSSES
  ) {
    return leftValue - rightValue;
  }

  return rightValue - leftValue;
}

function isMatchEligibleForStanding(match) {
  const status = readMatchField(match, "status");
  const homeScore = readMatchField(match, "homeScore");
  const awayScore = readMatchField(match, "awayScore");

  if (
    status === ChampionshipMatchStatus.CANCELLED ||
    status === ChampionshipMatchStatus.POSTPONED
  ) {
    return false;
  }

  return isValidScore(homeScore) && isValidScore(awayScore);
}

function isValidScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed);
}

function createStandingKey(groupId, registrationId) {
  return `${groupId || "grupo"}:${registrationId || "inscricao"}`;
}

function createGroupFallback(match, groupId) {
  return {
    displayOrder: 0,
    id: groupId,
    name: readMatchField(match, "groupName") || "Grupo",
    registrations: [],
  };
}

function createRegistrationFallback(match, side, groupId, registrationId) {
  return {
    groupId,
    registrationId,
    status: RegistrationStatus.CONFIRMED,
    teamAcronym: readMatchField(match, `${side}TeamAcronym`),
    teamId: readMatchField(match, `${side}TeamId`),
    teamName: readMatchField(match, `${side}TeamName`) || registrationId,
  };
}

function toSqlDateTime(value) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function readStandingField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readStandingJson(value) {
  return value?.toJSON?.() || { ...value };
}

function readMatchField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readGroupField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readRegistrationField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readGroupRegistrations(group) {
  const registrations = group?.registrations ?? group?.toJSON?.()?.registrations;
  return Array.isArray(registrations) ? registrations : [];
}

module.exports = {
  ChampionshipStandingService,
  STANDING_CHAMPIONSHIP_NOT_FOUND_CODE,
  STANDING_GROUP_NOT_FOUND_CODE,
  STANDING_REPOSITORY_REQUIRED_CODE,
};
