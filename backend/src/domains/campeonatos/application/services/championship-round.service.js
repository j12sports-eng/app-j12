const {
  toChampionshipMatchAdminDto,
  toChampionshipMatchAdminListDto,
  toChampionshipRoundAdminDto,
  toChampionshipRoundAdminListDto,
} = require("../dtos/index.js");
const {
  validateChampionshipMatchId,
  validateChampionshipMatchListInput,
  validateChampionshipRoundChampionshipId,
  validateChampionshipRoundId,
  validateChampionshipRoundListInput,
  validateCreateChampionshipMatchInput,
  validateCreateChampionshipRoundInput,
  validateGenerateChampionshipMatchesInput,
  validateMoveChampionshipMatchInput,
  validateUpdateChampionshipMatchInput,
  validateUpdateChampionshipRoundInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const {
  ChampionshipMatchStatus,
  ChampionshipRoundPhase,
} = require("../../shared/constants/index.js");
const { controlledError, nullableText } = require("../../shared/utils/index.js");

const ROUND_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_ROUND_REPOSITORY_REQUIRED";
const ROUND_GROUP_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_ROUND_GROUP_REPOSITORY_REQUIRED";
const ROUND_REGISTRATION_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_ROUND_REGISTRATION_REPOSITORY_REQUIRED";
const ROUND_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_ROUND_CHAMPIONSHIP_REPOSITORY_REQUIRED";
const ROUND_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_ROUND_CHAMPIONSHIP_NOT_FOUND";
const ROUND_NOT_FOUND_CODE = "CHAMPIONSHIP_ROUND_NOT_FOUND";
const ROUND_DUPLICATE_NUMBER_CODE = "CHAMPIONSHIP_ROUND_DUPLICATE_NUMBER";
const ROUND_NOT_EMPTY_CODE = "CHAMPIONSHIP_ROUND_NOT_EMPTY";
const MATCH_NOT_FOUND_CODE = "CHAMPIONSHIP_MATCH_NOT_FOUND";
const MATCH_DUPLICATE_CODE = "CHAMPIONSHIP_MATCH_DUPLICATE";
const MATCH_SAME_TEAM_CODE = "CHAMPIONSHIP_MATCH_SAME_TEAM";
const MATCH_COURT_CONFLICT_CODE = "CHAMPIONSHIP_MATCH_COURT_CONFLICT";
const MATCH_REGISTRATION_NOT_FOUND_CODE = "CHAMPIONSHIP_MATCH_REGISTRATION_NOT_FOUND";
const MATCH_REGISTRATION_INACTIVE_CODE = "CHAMPIONSHIP_MATCH_REGISTRATION_INACTIVE";
const MATCH_REGISTRATION_GROUP_INVALID_CODE = "CHAMPIONSHIP_MATCH_REGISTRATION_GROUP_INVALID";
const MATCH_GENERATION_ALREADY_EXISTS_CODE = "CHAMPIONSHIP_MATCH_GENERATION_ALREADY_EXISTS";
const MATCH_GENERATION_NO_GROUPS_CODE = "CHAMPIONSHIP_MATCH_GENERATION_NO_GROUPS";
const MATCH_RESULT_INVALID_CODE = "CHAMPIONSHIP_MATCH_RESULT_INVALID";

const ACTIVE_REGISTRATION_STATUSES = new Set([
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING,
]);

class ChampionshipRoundService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || null;
    this.groupRepository = options.groupRepository || options.championshipGroupRepository || null;
    this.registrationRepository =
      options.registrationRepository || options.championshipRegistrationRepository || null;
    this.roundRepository =
      options.roundRepository || options.championshipRoundRepository || options.repository || null;
    this.standingService = options.standingService || options.championshipStandingService || null;
  }

  async createRound(championshipId, input = {}, context = {}) {
    const values = validateCreateChampionshipRoundInput(championshipId, input);
    await this.requireChampionship(values.championshipId);

    const roundNumber =
      values.roundNumber === null
        ? await this.getRoundRepository().getNextRoundNumber(values.championshipId, values.phase)
        : values.roundNumber;

    await this.ensureRoundNumberAvailable(values.championshipId, values.phase, roundNumber);

    const round = await this.getRoundRepository().createRound({
      ...values,
      createdBy: readActor(context),
      roundNumber,
      updatedBy: readActor(context),
    });

    return toChampionshipRoundAdminDto(round);
  }

  async updateRound(championshipId, roundId, input = {}, context = {}) {
    const values = validateUpdateChampionshipRoundInput(championshipId, roundId, input);
    const round = await this.requireRound(values.championshipId, values.roundId);
    const nextPhase = Object.prototype.hasOwnProperty.call(values, "phase")
      ? values.phase
      : readRoundField(round, "phase");
    const nextRoundNumber = Object.prototype.hasOwnProperty.call(values, "roundNumber")
      ? values.roundNumber
      : readRoundField(round, "roundNumber");

    if (
      nextPhase !== readRoundField(round, "phase") ||
      Number(nextRoundNumber) !== Number(readRoundField(round, "roundNumber"))
    ) {
      await this.ensureRoundNumberAvailable(
        values.championshipId,
        nextPhase,
        nextRoundNumber,
        values.roundId,
      );
    }

    const updated = await this.getRoundRepository().updateRound(
      values.championshipId,
      values.roundId,
      {
        name: Object.prototype.hasOwnProperty.call(values, "name") ? values.name : undefined,
        phase: Object.prototype.hasOwnProperty.call(values, "phase") ? values.phase : undefined,
        roundNumber: Object.prototype.hasOwnProperty.call(values, "roundNumber")
          ? values.roundNumber
          : undefined,
        updatedBy: readActor(context),
      },
    );

    return toChampionshipRoundAdminDto(updated || round);
  }

  async deleteRound(championshipId, roundId) {
    const campId = validateChampionshipRoundChampionshipId(championshipId);
    const id = validateChampionshipRoundId(roundId);
    const round = await this.requireRound(campId, id);
    const totalMatches = await this.getRoundRepository().countMatchesByRound(id);

    if (totalMatches > 0) {
      throw controlledError("Rodada com jogos nao pode ser removida.", ROUND_NOT_EMPTY_CODE, 409, {
        roundId: id,
        totalMatches,
      });
    }

    const removed = await this.getRoundRepository().deleteRound(campId, id);
    return toChampionshipRoundAdminDto(removed || round);
  }

  async findRoundsByChampionship(championshipId, input = {}) {
    const filters = validateChampionshipRoundListInput(championshipId, input);
    await this.requireChampionship(filters.championshipId);

    const result = await this.getRoundRepository().findRoundsByChampionship(filters);
    const items = Array.isArray(result?.items) ? result.items : result || [];
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toChampionshipRoundAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async findRoundById(championshipId, roundId) {
    const campId = validateChampionshipRoundChampionshipId(championshipId);
    const id = validateChampionshipRoundId(roundId);
    return toChampionshipRoundAdminDto(await this.requireRound(campId, id));
  }

  async createMatch(championshipId, roundId, input = {}, context = {}) {
    const values = validateCreateChampionshipMatchInput(championshipId, roundId, input);
    const round = await this.requireRound(values.championshipId, values.roundId);
    const payload = await this.prepareMatchPayload(
      values.championshipId,
      {
        ...values,
        phase: readRoundField(round, "phase"),
      },
      null,
    );
    const payloadWithResult = this.normalizeMatchResultPayload(payload, null);

    const match = await this.getRoundRepository().createMatch({
      ...payloadWithResult,
      createdBy: readActor(context),
      roundId: values.roundId,
      updatedBy: readActor(context),
    });

    if (hasCompleteResult(payloadWithResult)) {
      await this.recalculateStandingsAfterResultChange(values.championshipId, context);
    }

    return toChampionshipMatchAdminDto(match);
  }

  async updateMatch(championshipId, matchId, input = {}, context = {}) {
    const values = validateUpdateChampionshipMatchInput(championshipId, matchId, input);
    const match = await this.requireMatch(values.championshipId, values.matchId);
    const resultFieldsWereSubmitted =
      Object.prototype.hasOwnProperty.call(values, "homeScore") ||
      Object.prototype.hasOwnProperty.call(values, "awayScore");
    const standingFieldsWereSubmitted = [
      "awayRegistrationId",
      "groupId",
      "homeRegistrationId",
      "status",
    ].some((fieldName) => Object.prototype.hasOwnProperty.call(values, fieldName));
    const payload = await this.prepareMatchPayload(
      values.championshipId,
      {
        awayRegistrationId: Object.prototype.hasOwnProperty.call(values, "awayRegistrationId")
          ? values.awayRegistrationId
          : readMatchField(match, "awayRegistrationId"),
        court: Object.prototype.hasOwnProperty.call(values, "court")
          ? values.court
          : readMatchField(match, "court"),
        groupId: Object.prototype.hasOwnProperty.call(values, "groupId")
          ? values.groupId
          : readMatchField(match, "groupId"),
        homeRegistrationId: Object.prototype.hasOwnProperty.call(values, "homeRegistrationId")
          ? values.homeRegistrationId
          : readMatchField(match, "homeRegistrationId"),
        homeScore: Object.prototype.hasOwnProperty.call(values, "homeScore")
          ? values.homeScore
          : readMatchField(match, "homeScore"),
        matchDate: Object.prototype.hasOwnProperty.call(values, "matchDate")
          ? values.matchDate
          : readMatchField(match, "matchDate"),
        phase: readMatchField(match, "phase"),
        startTime: Object.prototype.hasOwnProperty.call(values, "startTime")
          ? values.startTime
          : readMatchField(match, "startTime"),
        status: Object.prototype.hasOwnProperty.call(values, "status")
          ? values.status
          : readMatchField(match, "status"),
        awayScore: Object.prototype.hasOwnProperty.call(values, "awayScore")
          ? values.awayScore
          : readMatchField(match, "awayScore"),
      },
      values.matchId,
    );
    const payloadWithResult = this.normalizeMatchResultPayload(payload, match, {
      statusWasSubmitted: Object.prototype.hasOwnProperty.call(values, "status"),
      resultFieldsWereSubmitted,
    });

    const updated = await this.getRoundRepository().updateMatch(
      values.championshipId,
      values.matchId,
      {
        ...payloadWithResult,
        updatedBy: readActor(context),
      },
    );

    if (
      resultFieldsWereSubmitted ||
      (standingFieldsWereSubmitted &&
        (hasCompleteResult(match) || hasCompleteResult(payloadWithResult)))
    ) {
      await this.recalculateStandingsAfterResultChange(values.championshipId, context);
    }

    return toChampionshipMatchAdminDto(updated || match);
  }

  async deleteMatch(championshipId, matchId, context = {}) {
    const campId = validateChampionshipRoundChampionshipId(championshipId);
    const id = validateChampionshipMatchId(matchId);
    const match = await this.requireMatch(campId, id);
    const removed = await this.getRoundRepository().deleteMatch(campId, id);

    if (hasCompleteResult(match)) {
      await this.recalculateStandingsAfterResultChange(campId, context);
    }

    return toChampionshipMatchAdminDto(removed || match);
  }

  async moveMatch(championshipId, matchId, input = {}, context = {}) {
    const values = validateMoveChampionshipMatchInput(championshipId, matchId, input);
    await this.requireMatch(values.championshipId, values.matchId);
    const targetRound = await this.requireRound(values.championshipId, values.targetRoundId);
    const moved = await this.getRoundRepository().moveMatch(values.championshipId, values.matchId, {
      phase: readRoundField(targetRound, "phase"),
      targetRoundId: values.targetRoundId,
      updatedBy: readActor(context),
    });

    return toChampionshipMatchAdminDto(moved);
  }

  async findMatches(championshipId, input = {}) {
    const filters = validateChampionshipMatchListInput(championshipId, input);
    await this.requireChampionship(filters.championshipId);

    const result = await this.getRoundRepository().findMatches(filters);
    const items = Array.isArray(result?.items) ? result.items : result || [];
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toChampionshipMatchAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async generateMatches(championshipId, input = {}, context = {}) {
    const values = validateGenerateChampionshipMatchesInput(championshipId, input);
    await this.requireChampionship(values.championshipId);

    const existingMatches = await this.getRoundRepository().countMatchesByPhase(
      values.championshipId,
      values.phase,
    );

    if (existingMatches > 0 && !values.replace) {
      throw controlledError(
        "A fase ja possui jogos gerados. Use substituir para refazer.",
        MATCH_GENERATION_ALREADY_EXISTS_CODE,
        409,
        { championshipId: values.championshipId, phase: values.phase },
      );
    }

    const groups = await this.findGroupsWithRegistrations(values.championshipId);

    if (groups.length === 0) {
      throw controlledError(
        "Nao ha grupos com equipes suficientes para gerar jogos.",
        MATCH_GENERATION_NO_GROUPS_CODE,
        409,
        { championshipId: values.championshipId, phase: values.phase },
      );
    }

    if (values.replace) {
      await this.getRoundRepository().deleteMatchesByPhase(values.championshipId, values.phase);
      await this.recalculateStandingsAfterResultChange(values.championshipId, context);
    }

    let createdCount = 0;

    for (const fixture of buildGroupStageFixtures(groups)) {
      const round = await this.ensureRoundForFixture(
        values.championshipId,
        values.phase,
        fixture,
        context,
      );

      await this.getRoundRepository().createMatch({
        awayRegistrationId: fixture.awayRegistrationId,
        championshipId: values.championshipId,
        createdBy: readActor(context),
        groupId: fixture.groupId,
        homeRegistrationId: fixture.homeRegistrationId,
        phase: values.phase,
        roundId: readRoundField(round, "id"),
        status: ChampionshipMatchStatus.SCHEDULED,
        updatedBy: readActor(context),
      });
      createdCount += 1;
    }

    const result = await this.findRoundsByChampionship(values.championshipId, {
      limit: 100,
      phase: values.phase,
      sortBy: "roundNumber",
      sortDirection: "ASC",
    });

    return {
      ...result,
      generated: createdCount,
      phase: values.phase,
    };
  }

  async prepareMatchPayload(championshipId, values, ignoredMatchId) {
    if (values.homeRegistrationId === values.awayRegistrationId) {
      throw controlledError(
        "Mandante e visitante devem ser equipes diferentes.",
        MATCH_SAME_TEAM_CODE,
        400,
        { registrationId: values.homeRegistrationId },
      );
    }

    const group = await this.requireGroup(championshipId, values.groupId);
    await this.requireGroupRegistration(group, values.homeRegistrationId);
    await this.requireGroupRegistration(group, values.awayRegistrationId);
    await this.requireActiveRegistration(championshipId, values.homeRegistrationId);
    await this.requireActiveRegistration(championshipId, values.awayRegistrationId);
    await this.ensureMatchNotDuplicated({ ...values, championshipId }, ignoredMatchId);
    await this.ensureCourtAvailable({ ...values, championshipId }, ignoredMatchId);

    return values;
  }

  normalizeMatchResultPayload(values = {}, currentMatch = null, options = {}) {
    const resultFieldsWereSubmitted =
      options.resultFieldsWereSubmitted ||
      Object.prototype.hasOwnProperty.call(values, "homeScore") ||
      Object.prototype.hasOwnProperty.call(values, "awayScore");
    const statusWasSubmitted =
      options.statusWasSubmitted || Object.prototype.hasOwnProperty.call(values, "status");
    const homeScore = Object.prototype.hasOwnProperty.call(values, "homeScore")
      ? values.homeScore
      : readMatchField(currentMatch, "homeScore");
    const awayScore = Object.prototype.hasOwnProperty.call(values, "awayScore")
      ? values.awayScore
      : readMatchField(currentMatch, "awayScore");
    let status =
      values.status || readMatchField(currentMatch, "status") || ChampionshipMatchStatus.SCHEDULED;
    const hasHomeScore = homeScore !== null && typeof homeScore !== "undefined";
    const hasAwayScore = awayScore !== null && typeof awayScore !== "undefined";
    const hasCompleteResult = hasHomeScore && hasAwayScore;
    const hasNoResult = !hasHomeScore && !hasAwayScore;

    if (!hasCompleteResult && !hasNoResult) {
      throw controlledError(
        "Informe gols de mandante e visitante para salvar o resultado.",
        MATCH_RESULT_INVALID_CODE,
        400,
        {
          awayScore,
          homeScore,
        },
      );
    }

    if (status === ChampionshipMatchStatus.FINISHED && !hasCompleteResult) {
      throw controlledError(
        "Jogo encerrado exige gols de mandante e visitante.",
        MATCH_RESULT_INVALID_CODE,
        400,
        {
          awayScore,
          homeScore,
          status,
        },
      );
    }

    if (resultFieldsWereSubmitted && !statusWasSubmitted && hasCompleteResult) {
      status = ChampionshipMatchStatus.FINISHED;
    }

    if (
      resultFieldsWereSubmitted &&
      !statusWasSubmitted &&
      hasNoResult &&
      status === ChampionshipMatchStatus.FINISHED
    ) {
      status = ChampionshipMatchStatus.SCHEDULED;
    }

    return {
      ...values,
      awayScore: hasAwayScore ? Number(awayScore) : null,
      homeScore: hasHomeScore ? Number(homeScore) : null,
      status,
    };
  }

  async recalculateStandingsAfterResultChange(championshipId, context = {}) {
    if (!this.standingService || typeof this.standingService.recalculate !== "function") return;

    await this.standingService.recalculate(championshipId, {}, context);
  }

  async ensureRoundForFixture(championshipId, phase, fixture, context = {}) {
    const existing = await this.getRoundRepository().findRoundByNumber(
      championshipId,
      phase,
      fixture.roundNumber,
    );

    if (existing) return existing;

    return this.getRoundRepository().createRound({
      championshipId,
      createdBy: readActor(context),
      name: `Rodada ${fixture.roundNumber}`,
      phase,
      roundNumber: fixture.roundNumber,
      updatedBy: readActor(context),
    });
  }

  async findGroupsWithRegistrations(championshipId) {
    const result = await this.getGroupRepository().findAllByChampionship({
      championshipId,
      limit: 100,
      page: 1,
      sortBy: "displayOrder",
      sortDirection: "ASC",
    });
    const groups = Array.isArray(result?.items) ? result.items : result || [];

    return groups
      .map((group) => ({
        ...group,
        registrations: readGroupRegistrations(group).filter((registration) =>
          ACTIVE_REGISTRATION_STATUSES.has(readRegistrationField(registration, "status")),
        ),
      }))
      .filter((group) => group.registrations.length >= 2);
  }

  async requireChampionship(championshipId) {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado para rodadas.",
        ROUND_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    const championship = await this.championshipRepository.findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado para rodadas.",
        ROUND_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  async requireRound(championshipId, roundId) {
    const round = await this.getRoundRepository().findRoundById(championshipId, roundId);

    if (!round) {
      throw controlledError("Rodada nao encontrada.", ROUND_NOT_FOUND_CODE, 404, {
        championshipId,
        roundId,
      });
    }

    return round;
  }

  async requireMatch(championshipId, matchId) {
    const match = await this.getRoundRepository().findMatchById(championshipId, matchId);

    if (!match) {
      throw controlledError("Jogo nao encontrado.", MATCH_NOT_FOUND_CODE, 404, {
        championshipId,
        matchId,
      });
    }

    return match;
  }

  async requireGroup(championshipId, groupId) {
    const group = await this.getGroupRepository().findById(championshipId, groupId);

    if (!group) {
      throw controlledError("Grupo nao encontrado para jogo.", ROUND_NOT_FOUND_CODE, 404, {
        championshipId,
        groupId,
      });
    }

    return group;
  }

  async requireGroupRegistration(group, registrationId) {
    const registrations = readGroupRegistrations(group);
    const found = registrations.find(
      (registration) => readRegistrationField(registration, "registrationId") === registrationId,
    );

    if (!found) {
      throw controlledError(
        "Equipe inscrita nao pertence ao grupo informado.",
        MATCH_REGISTRATION_GROUP_INVALID_CODE,
        409,
        { groupId: readRoundField(group, "id"), registrationId },
      );
    }

    if (!ACTIVE_REGISTRATION_STATUSES.has(readRegistrationField(found, "status"))) {
      throw controlledError(
        "Apenas inscricoes pendentes ou confirmadas podem gerar jogos.",
        MATCH_REGISTRATION_INACTIVE_CODE,
        409,
        { registrationId, status: readRegistrationField(found, "status") },
      );
    }

    return found;
  }

  async requireActiveRegistration(championshipId, registrationId) {
    const registration = await this.getRegistrationRepository().findById(registrationId);

    if (!registration || readRegistrationField(registration, "championshipId") !== championshipId) {
      throw controlledError(
        "Inscricao nao encontrada para jogo.",
        MATCH_REGISTRATION_NOT_FOUND_CODE,
        404,
        { championshipId, registrationId },
      );
    }

    const status = readRegistrationField(registration, "status");

    if (!ACTIVE_REGISTRATION_STATUSES.has(status)) {
      throw controlledError(
        "Apenas inscricoes pendentes ou confirmadas podem gerar jogos.",
        MATCH_REGISTRATION_INACTIVE_CODE,
        409,
        { registrationId, status },
      );
    }

    return registration;
  }

  async ensureRoundNumberAvailable(championshipId, phase, roundNumber, ignoredRoundId = null) {
    const existing = await this.getRoundRepository().findRoundByNumber(
      championshipId,
      phase,
      roundNumber,
    );

    if (existing && readRoundField(existing, "id") !== ignoredRoundId) {
      throw controlledError(
        "Ja existe rodada com este numero nesta fase.",
        ROUND_DUPLICATE_NUMBER_CODE,
        409,
        { championshipId, phase, roundNumber },
      );
    }
  }

  async ensureMatchNotDuplicated(values, ignoredMatchId = null) {
    const duplicate = await this.getRoundRepository().findDuplicateMatch({
      awayRegistrationId: values.awayRegistrationId,
      championshipId: values.championshipId,
      groupId: values.groupId,
      homeRegistrationId: values.homeRegistrationId,
      ignoredMatchId,
      phase: values.phase,
    });

    if (duplicate) {
      throw controlledError(
        "Jogo entre estas equipes ja existe na fase.",
        MATCH_DUPLICATE_CODE,
        409,
        { duplicateMatchId: readMatchField(duplicate, "id") },
      );
    }
  }

  async ensureCourtAvailable(values, ignoredMatchId = null) {
    if (!values.matchDate || !values.startTime || !values.court) return;

    const conflict = await this.getRoundRepository().findCourtConflict({
      championshipId: values.championshipId,
      court: values.court,
      ignoredMatchId,
      matchDate: values.matchDate,
      startTime: values.startTime,
    });

    if (conflict) {
      throw controlledError(
        "Ja existe jogo agendado para esta quadra e horario.",
        MATCH_COURT_CONFLICT_CODE,
        409,
        { conflictMatchId: readMatchField(conflict, "id") },
      );
    }
  }

  getRoundRepository() {
    if (!this.roundRepository) {
      throw controlledError(
        "ChampionshipRoundRepository nao configurado.",
        ROUND_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.roundRepository;
  }

  getGroupRepository() {
    if (!this.groupRepository) {
      throw controlledError(
        "ChampionshipGroupRepository nao configurado para rodadas.",
        ROUND_GROUP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.groupRepository;
  }

  getRegistrationRepository() {
    if (!this.registrationRepository) {
      throw controlledError(
        "ChampionshipRegistrationRepository nao configurado para jogos.",
        ROUND_REGISTRATION_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.registrationRepository;
  }
}

function buildGroupStageFixtures(groups = []) {
  return groups.flatMap((group) => {
    const registrations = readGroupRegistrations(group)
      .slice()
      .sort(
        (left, right) =>
          Number(readRegistrationField(left, "drawPosition") || 0) -
            Number(readRegistrationField(right, "drawPosition") || 0) ||
          String(readRegistrationField(left, "teamName") || "").localeCompare(
            String(readRegistrationField(right, "teamName") || ""),
          ),
      );
    const slots =
      registrations.length % 2 === 0 ? registrations.slice() : registrations.concat([null]);
    const roundCount = slots.length - 1;
    const fixtures = [];

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      for (let pairIndex = 0; pairIndex < slots.length / 2; pairIndex += 1) {
        const left = slots[pairIndex];
        const right = slots[slots.length - 1 - pairIndex];

        if (!left || !right) continue;

        const invertHome = roundIndex % 2 === 1;
        const home = invertHome ? right : left;
        const away = invertHome ? left : right;

        fixtures.push({
          awayRegistrationId: readRegistrationField(away, "registrationId"),
          groupId: readRoundField(group, "id"),
          homeRegistrationId: readRegistrationField(home, "registrationId"),
          roundNumber: roundIndex + 1,
        });
      }

      const fixed = slots[0];
      const rotating = slots.slice(1);
      rotating.unshift(rotating.pop());
      slots.splice(0, slots.length, fixed, ...rotating);
    }

    return fixtures;
  });
}

function readActor(context = {}) {
  return (
    nullableText(
      context.actorId ||
        context.user?.email ||
        context.user?.login ||
        context.user?.id ||
        context.auth?.email ||
        context.auth?.login ||
        context.auth?.id,
      191,
    ) || "sistema"
  );
}

function readRoundField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readMatchField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function hasCompleteResult(match) {
  const homeScore = readMatchField(match, "homeScore");
  const awayScore = readMatchField(match, "awayScore");
  return isValidScore(homeScore) && isValidScore(awayScore);
}

function isValidScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed);
}

function readRegistrationField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readGroupRegistrations(group) {
  const registrations = group?.registrations ?? group?.toJSON?.()?.registrations;
  return Array.isArray(registrations) ? registrations : [];
}

module.exports = {
  ChampionshipRoundService,
  MATCH_COURT_CONFLICT_CODE,
  MATCH_DUPLICATE_CODE,
  MATCH_GENERATION_ALREADY_EXISTS_CODE,
  MATCH_GENERATION_NO_GROUPS_CODE,
  MATCH_NOT_FOUND_CODE,
  MATCH_REGISTRATION_GROUP_INVALID_CODE,
  MATCH_REGISTRATION_INACTIVE_CODE,
  MATCH_REGISTRATION_NOT_FOUND_CODE,
  MATCH_RESULT_INVALID_CODE,
  MATCH_SAME_TEAM_CODE,
  ROUND_DUPLICATE_NUMBER_CODE,
  ROUND_NOT_EMPTY_CODE,
  ROUND_NOT_FOUND_CODE,
};
