const {
  toChampionshipBracketAdminDto,
  toChampionshipBracketMatchAdminDto,
} = require("../dtos/index.js");
const {
  validateAdvanceChampionshipBracketMatchInput,
  validateChampionshipBracketChampionshipId,
  validateChampionshipBracketPhaseInput,
  validateGenerateChampionshipBracketInput,
  validateUpdateChampionshipBracketMatchInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const {
  CHAMPIONSHIP_BRACKET_PHASE_ORDER,
  ChampionshipBracketMode,
  ChampionshipBracketPhase,
  ChampionshipBracketSlot,
  ChampionshipBracketStatus,
  ChampionshipMatchStatus,
} = require("../../shared/constants/index.js");
const { controlledError, createId } = require("../../shared/utils/index.js");

const BRACKET_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_BRACKET_REPOSITORY_REQUIRED";
const BRACKET_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_BRACKET_CHAMPIONSHIP_REPOSITORY_REQUIRED";
const BRACKET_STANDING_SERVICE_REQUIRED_CODE = "CHAMPIONSHIP_BRACKET_STANDING_SERVICE_REQUIRED";
const BRACKET_REGISTRATION_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_BRACKET_REGISTRATION_REPOSITORY_REQUIRED";
const BRACKET_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_BRACKET_CHAMPIONSHIP_NOT_FOUND";
const BRACKET_NOT_FOUND_CODE = "CHAMPIONSHIP_BRACKET_NOT_FOUND";
const BRACKET_MATCH_NOT_FOUND_CODE = "CHAMPIONSHIP_BRACKET_MATCH_NOT_FOUND";

const ACTIVE_REGISTRATION_STATUSES = new Set([
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING,
]);

class ChampionshipBracketService {
  constructor(options = {}) {
    this.bracketRepository =
      options.bracketRepository ||
      options.championshipBracketRepository ||
      options.repository ||
      null;
    this.championshipRepository = options.championshipRepository || null;
    this.registrationRepository =
      options.registrationRepository || options.championshipRegistrationRepository || null;
    this.standingService = options.standingService || options.championshipStandingService || null;
  }

  async findByChampionship(championshipId) {
    const id = validateChampionshipBracketChampionshipId(championshipId);
    await this.requireChampionship(id);
    const bracket = await this.getBracketRepository().findByChampionship(id);
    return toChampionshipBracketAdminDto(bracket);
  }

  async findByPhase(championshipId, phase) {
    const values = validateChampionshipBracketPhaseInput(championshipId, phase);
    await this.requireChampionship(values.championshipId);
    const bracket = await this.getBracketRepository().findByPhase(
      values.championshipId,
      values.phase,
    );
    return toChampionshipBracketAdminDto(bracket);
  }

  async generate(championshipId, input = {}, context = {}) {
    const values = validateGenerateChampionshipBracketInput(championshipId, input);
    const actor = readActor(context);
    await this.requireChampionship(values.championshipId);

    if (values.includeThirdPlace && values.teamCount < 4) {
      throw controlledError(
        "Disputa de terceiro lugar exige pelo menos semifinal.",
        "CHAMPIONSHIP_BRACKET_THIRD_PLACE_INVALID",
        400,
        { teamCount: values.teamCount },
      );
    }

    const existing = await this.getBracketRepository().findByChampionship(values.championshipId);

    if (existing && !values.replace) {
      throw controlledError(
        "Ja existe mata-mata gerado para este campeonato.",
        "CHAMPIONSHIP_BRACKET_ALREADY_EXISTS",
        409,
        { championshipId: values.championshipId },
      );
    }

    if (existing && (await this.getBracketRepository().hasStarted(values.championshipId))) {
      throw controlledError(
        "Mata-mata iniciado nao pode ser recalculado.",
        "CHAMPIONSHIP_BRACKET_ALREADY_STARTED",
        409,
        { championshipId: values.championshipId },
      );
    }

    const firstPairs =
      values.mode === ChampionshipBracketMode.MANUAL
        ? await this.buildManualPairs(values)
        : await this.buildAutomaticPairs(values);
    const { bracket, matches } = buildBracketTree({
      actor,
      championshipId: values.championshipId,
      firstPairs,
      includeThirdPlace: values.includeThirdPlace,
      initialPhase: values.initialPhase,
      mode: values.mode,
      teamCount: values.teamCount,
    });
    const created = await this.getBracketRepository().replaceByChampionship(
      values.championshipId,
      bracket,
      matches,
    );

    return toChampionshipBracketAdminDto(created);
  }

  async updateMatch(matchId, input = {}, context = {}) {
    const values = validateUpdateChampionshipBracketMatchInput(matchId, input);
    const actor = readActor(context);
    const match = await this.requireMatch(values.matchId);
    const bracket = await this.requireBracket(match.championshipId);
    const payload = await this.buildMatchUpdatePayload(match, bracket, values, actor);
    const updated = await this.getBracketRepository().updateMatch(values.matchId, payload);

    await this.applyAdvancement(updated, actor);
    const refreshed = await this.getBracketRepository().findMatchById(values.matchId);
    return toChampionshipBracketMatchAdminDto(refreshed);
  }

  async advanceMatch(matchId, input = {}, context = {}) {
    const values = validateAdvanceChampionshipBracketMatchInput(matchId, input);
    const actor = readActor(context);
    const match = await this.requireMatch(values.matchId);
    const winnerRegistrationId = values.winnerRegistrationId || inferWinnerFromScore(match) || null;

    if (!winnerRegistrationId) {
      throw controlledError(
        "Informe o vencedor ou o placar do jogo.",
        "CHAMPIONSHIP_BRACKET_WINNER_REQUIRED",
        400,
        { matchId: values.matchId },
      );
    }

    assertWinnerBelongsToMatch(match, winnerRegistrationId);

    const updated = await this.getBracketRepository().updateMatch(values.matchId, {
      status: ChampionshipMatchStatus.FINISHED,
      updatedBy: actor,
      winnerRegistrationId,
    });

    await this.applyAdvancement(updated, actor);
    const refreshed = await this.getBracketRepository().findMatchById(values.matchId);
    return toChampionshipBracketMatchAdminDto(refreshed);
  }

  async deleteByChampionship(championshipId) {
    const id = validateChampionshipBracketChampionshipId(championshipId);
    await this.requireChampionship(id);
    const bracket = await this.requireBracket(id);

    if (await this.getBracketRepository().hasStarted(id)) {
      throw controlledError(
        "Mata-mata iniciado nao pode ser removido.",
        "CHAMPIONSHIP_BRACKET_DELETE_STARTED",
        409,
        { championshipId: id },
      );
    }

    await this.getBracketRepository().deleteByChampionship(id);
    return toChampionshipBracketAdminDto(bracket);
  }

  async buildAutomaticPairs(values) {
    const standings = await this.getStandingService().recalculate(values.championshipId, {
      limit: 500,
      page: 1,
    });
    const items = Array.isArray(standings?.items) ? standings.items : [];
    const seeds = items
      .slice()
      .sort(
        (left, right) =>
          Number(readField(left, "overallPosition") || 0) -
          Number(readField(right, "overallPosition") || 0),
      )
      .slice(0, values.teamCount);

    if (seeds.length < values.teamCount) {
      throw controlledError(
        "Classificacao nao possui equipes suficientes para gerar o mata-mata.",
        "CHAMPIONSHIP_BRACKET_STANDINGS_INSUFFICIENT",
        400,
        { required: values.teamCount, total: seeds.length },
      );
    }

    return pairSeededRegistrations(seeds.map((item) => readField(item, "registrationId")));
  }

  async buildManualPairs(values) {
    const expectedMatches = values.teamCount / 2;

    if (values.manualMatches.length > expectedMatches) {
      throw controlledError(
        "Quantidade de confrontos manuais excede a fase inicial.",
        "CHAMPIONSHIP_BRACKET_MANUAL_MATCHES_EXCEEDED",
        400,
        { expected: expectedMatches, total: values.manualMatches.length },
      );
    }

    const pairs = values.manualMatches
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((match) => ({
        awayRegistrationId: match.awayRegistrationId,
        homeRegistrationId: match.homeRegistrationId,
      }));

    while (pairs.length < expectedMatches) {
      pairs.push({ awayRegistrationId: null, homeRegistrationId: null });
    }

    await this.validateManualPairs(values.championshipId, pairs);
    return pairs;
  }

  async validateManualPairs(championshipId, pairs) {
    const seen = new Set();

    for (const pair of pairs) {
      if (
        pair.homeRegistrationId &&
        pair.awayRegistrationId &&
        pair.homeRegistrationId === pair.awayRegistrationId
      ) {
        throw controlledError(
          "Um confronto do mata-mata exige equipes diferentes.",
          "CHAMPIONSHIP_BRACKET_MATCH_SAME_TEAM",
          400,
          { registrationId: pair.homeRegistrationId },
        );
      }

      for (const registrationId of [pair.homeRegistrationId, pair.awayRegistrationId].filter(
        Boolean,
      )) {
        if (seen.has(registrationId)) {
          throw controlledError(
            "Equipe repetida na mesma fase do mata-mata.",
            "CHAMPIONSHIP_BRACKET_TEAM_DUPLICATED",
            400,
            { registrationId },
          );
        }

        seen.add(registrationId);
        await this.requireActiveRegistration(championshipId, registrationId);
      }
    }
  }

  async buildMatchUpdatePayload(match, bracket, values, actor) {
    const payload = { updatedBy: actor };
    const nextState = { ...readJson(match) };

    for (const key of [
      "awayRegistrationId",
      "awayScore",
      "court",
      "homeRegistrationId",
      "homeScore",
      "matchDate",
      "startTime",
      "status",
      "winnerRegistrationId",
    ]) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        payload[key] = values[key];
        nextState[key] = values[key];
      }
    }

    if (hasTeamChange(values)) {
      if (isMatchStarted(match)) {
        throw controlledError(
          "Confronto iniciado nao pode ter equipes alteradas.",
          "CHAMPIONSHIP_BRACKET_MATCH_STARTED",
          409,
          { matchId: match.id },
        );
      }

      await this.validateEditableMatchTeams(match, bracket, nextState);
    }

    if (hasResultChange(values)) {
      const winnerRegistrationId =
        nextState.winnerRegistrationId || inferWinnerFromScore(nextState);

      if (winnerRegistrationId) {
        assertWinnerBelongsToMatch(nextState, winnerRegistrationId);
        payload.winnerRegistrationId = winnerRegistrationId;
        nextState.winnerRegistrationId = winnerRegistrationId;
      }

      if (
        (Number.isInteger(nextState.homeScore) && Number.isInteger(nextState.awayScore)) ||
        winnerRegistrationId
      ) {
        payload.status = values.status || ChampionshipMatchStatus.FINISHED;
      }

      if (payload.status === ChampionshipMatchStatus.FINISHED && !winnerRegistrationId) {
        throw controlledError(
          "Jogo finalizado exige vencedor definido.",
          "CHAMPIONSHIP_BRACKET_WINNER_REQUIRED",
          400,
          { matchId: match.id },
        );
      }
    }

    return payload;
  }

  async validateEditableMatchTeams(match, bracket, nextState) {
    const homeRegistrationId = nextState.homeRegistrationId || null;
    const awayRegistrationId = nextState.awayRegistrationId || null;

    if (homeRegistrationId && awayRegistrationId && homeRegistrationId === awayRegistrationId) {
      throw controlledError(
        "Um confronto do mata-mata exige equipes diferentes.",
        "CHAMPIONSHIP_BRACKET_MATCH_SAME_TEAM",
        400,
        { registrationId: homeRegistrationId },
      );
    }

    for (const registrationId of [homeRegistrationId, awayRegistrationId].filter(Boolean)) {
      await this.requireActiveRegistration(match.championshipId, registrationId);
    }

    assertDuplicatePairNotFound(bracket.matches, match.id, match.phase, {
      awayRegistrationId,
      homeRegistrationId,
    });

    for (const registrationId of [homeRegistrationId, awayRegistrationId].filter(Boolean)) {
      assertRegistrationNotRepeatedInPhase(bracket.matches, match.id, match.phase, registrationId);
    }
  }

  async applyAdvancement(match, actor) {
    if (!match?.winnerRegistrationId) return;

    const loserRegistrationId = findLoserRegistrationId(match);

    if (match.nextMatchId) {
      await this.assignTeamToTargetMatch(match.nextMatchId, match.nextMatchSlot, match, actor);
    }

    if (match.thirdPlaceMatchId && loserRegistrationId) {
      await this.assignTeamToTargetMatch(
        match.thirdPlaceMatchId,
        match.thirdPlaceSlot,
        { ...readJson(match), winnerRegistrationId: loserRegistrationId },
        actor,
      );
    }

    if (match.phase === ChampionshipBracketPhase.FINAL) {
      await this.getBracketRepository().updateBracket(match.bracketId, {
        championRegistrationId: match.winnerRegistrationId,
        runnerUpRegistrationId: loserRegistrationId,
        status: ChampionshipBracketStatus.FINISHED,
        updatedBy: actor,
      });
      return;
    }

    if (match.phase === ChampionshipBracketPhase.THIRD_PLACE) {
      await this.getBracketRepository().updateBracket(match.bracketId, {
        thirdPlaceRegistrationId: match.winnerRegistrationId,
        updatedBy: actor,
      });
      return;
    }

    await this.getBracketRepository().updateBracket(match.bracketId, {
      status: ChampionshipBracketStatus.IN_PROGRESS,
      updatedBy: actor,
    });
  }

  async assignTeamToTargetMatch(targetMatchId, slot, sourceMatch, actor) {
    const target = await this.requireMatch(targetMatchId);
    const property =
      slot === ChampionshipBracketSlot.AWAY ? "awayRegistrationId" : "homeRegistrationId";
    const currentRegistrationId = readField(target, property);
    const nextRegistrationId = sourceMatch.winnerRegistrationId;

    if (
      currentRegistrationId &&
      currentRegistrationId !== nextRegistrationId &&
      isMatchStarted(target)
    ) {
      throw controlledError(
        "Destino do avancamento ja foi iniciado.",
        "CHAMPIONSHIP_BRACKET_TARGET_STARTED",
        409,
        { matchId: targetMatchId },
      );
    }

    await this.getBracketRepository().updateMatch(targetMatchId, {
      [property]: nextRegistrationId,
      updatedBy: actor,
    });
  }

  async requireChampionship(championshipId) {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado para mata-mata.",
        BRACKET_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    const championship = await this.championshipRepository.findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado para mata-mata.",
        BRACKET_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  async requireBracket(championshipId) {
    const bracket = await this.getBracketRepository().findByChampionship(championshipId);

    if (!bracket) {
      throw controlledError(
        "Mata-mata nao encontrado para este campeonato.",
        BRACKET_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return bracket;
  }

  async requireMatch(matchId) {
    const match = await this.getBracketRepository().findMatchById(matchId);

    if (!match) {
      throw controlledError(
        "Jogo do mata-mata nao encontrado.",
        BRACKET_MATCH_NOT_FOUND_CODE,
        404,
        {
          matchId,
        },
      );
    }

    return match;
  }

  async requireActiveRegistration(championshipId, registrationId) {
    const registration = await this.getRegistrationRepository().findById(registrationId);

    if (
      !registration ||
      readField(registration, "championshipId") !== championshipId ||
      !ACTIVE_REGISTRATION_STATUSES.has(readField(registration, "status"))
    ) {
      throw controlledError(
        "Equipe do mata-mata deve estar pendente ou confirmada neste campeonato.",
        "CHAMPIONSHIP_BRACKET_REGISTRATION_INVALID",
        400,
        { championshipId, registrationId },
      );
    }

    return registration;
  }

  getBracketRepository() {
    if (!this.bracketRepository) {
      throw controlledError(
        "ChampionshipBracketRepository nao configurado.",
        BRACKET_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.bracketRepository;
  }

  getRegistrationRepository() {
    if (!this.registrationRepository) {
      throw controlledError(
        "ChampionshipRegistrationRepository nao configurado para mata-mata.",
        BRACKET_REGISTRATION_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.registrationRepository;
  }

  getStandingService() {
    if (!this.standingService) {
      throw controlledError(
        "ChampionshipStandingService nao configurado para mata-mata automatico.",
        BRACKET_STANDING_SERVICE_REQUIRED_CODE,
        500,
      );
    }

    return this.standingService;
  }
}

function buildBracketTree({
  actor,
  championshipId,
  firstPairs,
  includeThirdPlace,
  initialPhase,
  mode,
  teamCount,
}) {
  const bracketId = createId("chave");
  const sequence = phaseSequence(initialPhase);
  const matchesByPhase = new Map();

  sequence.forEach((phase, roundIndex) => {
    const matchCount = teamCount / 2 ** (roundIndex + 1);
    const matches = Array.from({ length: matchCount }, (_, index) => ({
      awayRegistrationId: firstPairs[index]?.awayRegistrationId || null,
      bracketId,
      championshipId,
      createdBy: actor,
      displayOrder: index + 1,
      homeRegistrationId: firstPairs[index]?.homeRegistrationId || null,
      id: createId("chave-jogo"),
      phase,
      roundOrder: roundIndex + 1,
      status: ChampionshipMatchStatus.SCHEDULED,
      updatedBy: actor,
    }));
    matchesByPhase.set(phase, matches);
  });

  for (let roundIndex = 0; roundIndex < sequence.length - 1; roundIndex += 1) {
    const currentMatches = matchesByPhase.get(sequence[roundIndex]) || [];
    const nextMatches = matchesByPhase.get(sequence[roundIndex + 1]) || [];

    currentMatches.forEach((match, index) => {
      const nextMatch = nextMatches[Math.floor(index / 2)];
      if (!nextMatch) return;

      match.nextMatchId = nextMatch.id;
      match.nextMatchSlot =
        index % 2 === 0 ? ChampionshipBracketSlot.HOME : ChampionshipBracketSlot.AWAY;
    });
  }

  if (includeThirdPlace) {
    const thirdPlaceMatch = {
      bracketId,
      championshipId,
      createdBy: actor,
      displayOrder: 1,
      id: createId("chave-jogo"),
      phase: ChampionshipBracketPhase.THIRD_PLACE,
      roundOrder: sequence.length + 1,
      status: ChampionshipMatchStatus.SCHEDULED,
      updatedBy: actor,
    };
    const semiFinalMatches = matchesByPhase.get(ChampionshipBracketPhase.SEMI_FINAL) || [];
    semiFinalMatches.forEach((match, index) => {
      match.thirdPlaceMatchId = thirdPlaceMatch.id;
      match.thirdPlaceSlot =
        index % 2 === 0 ? ChampionshipBracketSlot.HOME : ChampionshipBracketSlot.AWAY;
    });
    matchesByPhase.set(ChampionshipBracketPhase.THIRD_PLACE, [thirdPlaceMatch]);
  }

  return {
    bracket: {
      championshipId,
      createdBy: actor,
      id: bracketId,
      includeThirdPlace,
      initialPhase,
      mode,
      status: ChampionshipBracketStatus.READY,
      teamCount,
      updatedBy: actor,
    },
    matches: Array.from(matchesByPhase.values()).flat(),
  };
}

function phaseSequence(initialPhase) {
  const base = CHAMPIONSHIP_BRACKET_PHASE_ORDER.filter(
    (phase) => phase !== ChampionshipBracketPhase.THIRD_PLACE,
  );
  const start = base.indexOf(initialPhase);
  return start >= 0 ? base.slice(start) : [ChampionshipBracketPhase.FINAL];
}

function pairSeededRegistrations(registrationIds) {
  const pairs = [];
  let leftIndex = 0;
  let rightIndex = registrationIds.length - 1;

  while (leftIndex < rightIndex) {
    pairs.push({
      awayRegistrationId: registrationIds[rightIndex],
      homeRegistrationId: registrationIds[leftIndex],
    });
    leftIndex += 1;
    rightIndex -= 1;
  }

  return pairs;
}

function assertRegistrationNotRepeatedInPhase(matches, ignoredMatchId, phase, registrationId) {
  const duplicated = matches.find(
    (match) =>
      match.id !== ignoredMatchId &&
      match.phase === phase &&
      (match.homeRegistrationId === registrationId || match.awayRegistrationId === registrationId),
  );

  if (duplicated) {
    throw controlledError(
      "Equipe ja esta em outro confronto da fase.",
      "CHAMPIONSHIP_BRACKET_TEAM_DUPLICATED",
      400,
      { matchId: duplicated.id, registrationId },
    );
  }
}

function assertDuplicatePairNotFound(matches, ignoredMatchId, phase, pair) {
  if (!pair.homeRegistrationId || !pair.awayRegistrationId) return;

  const duplicated = matches.find((match) => {
    if (match.id === ignoredMatchId || match.phase !== phase) return false;

    return (
      (match.homeRegistrationId === pair.homeRegistrationId &&
        match.awayRegistrationId === pair.awayRegistrationId) ||
      (match.homeRegistrationId === pair.awayRegistrationId &&
        match.awayRegistrationId === pair.homeRegistrationId)
    );
  });

  if (duplicated) {
    throw controlledError(
      "Confronto duplicado na fase do mata-mata.",
      "CHAMPIONSHIP_BRACKET_MATCH_DUPLICATED",
      400,
      { matchId: duplicated.id },
    );
  }
}

function assertWinnerBelongsToMatch(match, winnerRegistrationId) {
  if (
    winnerRegistrationId !== readField(match, "homeRegistrationId") &&
    winnerRegistrationId !== readField(match, "awayRegistrationId")
  ) {
    throw controlledError(
      "Vencedor precisa ser uma das equipes do confronto.",
      "CHAMPIONSHIP_BRACKET_WINNER_INVALID",
      400,
      { matchId: readField(match, "id"), winnerRegistrationId },
    );
  }
}

function inferWinnerFromScore(match) {
  const homeScore = readField(match, "homeScore");
  const awayScore = readField(match, "awayScore");

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;

  if (homeScore === awayScore) {
    throw controlledError(
      "Jogo de mata-mata nao pode ser finalizado empatado.",
      "CHAMPIONSHIP_BRACKET_DRAW_INVALID",
      400,
      { matchId: readField(match, "id") },
    );
  }

  return homeScore > awayScore
    ? readField(match, "homeRegistrationId")
    : readField(match, "awayRegistrationId");
}

function findLoserRegistrationId(match) {
  if (!match?.winnerRegistrationId) return null;
  return match.winnerRegistrationId === match.homeRegistrationId
    ? match.awayRegistrationId
    : match.homeRegistrationId;
}

function isMatchStarted(match) {
  return (
    readField(match, "status") !== ChampionshipMatchStatus.SCHEDULED ||
    Number.isInteger(readField(match, "homeScore")) ||
    Number.isInteger(readField(match, "awayScore")) ||
    Boolean(readField(match, "winnerRegistrationId"))
  );
}

function hasTeamChange(values) {
  return (
    Object.prototype.hasOwnProperty.call(values, "awayRegistrationId") ||
    Object.prototype.hasOwnProperty.call(values, "homeRegistrationId")
  );
}

function hasResultChange(values) {
  return (
    Object.prototype.hasOwnProperty.call(values, "awayScore") ||
    Object.prototype.hasOwnProperty.call(values, "homeScore") ||
    Object.prototype.hasOwnProperty.call(values, "status") ||
    Object.prototype.hasOwnProperty.call(values, "winnerRegistrationId")
  );
}

function readActor(context) {
  return (
    context?.auth?.email || context?.auth?.id || context?.user?.email || context?.user?.id || null
  );
}

function readField(value, fieldName) {
  return value?.[fieldName] ?? value?.toJSON?.()?.[fieldName] ?? null;
}

function readJson(value) {
  return value?.toJSON?.() || { ...value };
}

module.exports = {
  BRACKET_CHAMPIONSHIP_NOT_FOUND_CODE,
  BRACKET_MATCH_NOT_FOUND_CODE,
  BRACKET_NOT_FOUND_CODE,
  BRACKET_REPOSITORY_REQUIRED_CODE,
  ChampionshipBracketService,
};
