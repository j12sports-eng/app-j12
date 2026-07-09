const { toChampionshipMatchReportAdminDto } = require("../dtos/index.js");
const {
  validateChampionshipMatchReportMatchId,
  validateCreateChampionshipMatchEventInput,
  validateCreateChampionshipMatchReportInput,
  validateDeleteChampionshipMatchEventInput,
  validateFinalizeChampionshipMatchReportInput,
  validateUpdateChampionshipMatchEventInput,
  validateUpdateChampionshipMatchReportInput,
} = require("../validators/index.js");
const {
  CHAMPIONSHIP_MATCH_EVENT_PLAYER_REQUIRED_TYPES,
  CHAMPIONSHIP_MATCH_EVENT_TEAM_REQUIRED_TYPES,
  ChampionshipMatchEventType,
  ChampionshipMatchReportStatus,
  ChampionshipMatchStatus,
} = require("../../shared/constants/index.js");
const { controlledError } = require("../../shared/utils/index.js");

const MATCH_REPORT_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_MATCH_REPORT_REPOSITORY_REQUIRED";
const MATCH_REPORT_PLAYER_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_MATCH_REPORT_PLAYER_REPOSITORY_REQUIRED";
const MATCH_REPORT_ROUND_SERVICE_REQUIRED_CODE = "CHAMPIONSHIP_MATCH_REPORT_ROUND_SERVICE_REQUIRED";
const MATCH_REPORT_MATCH_NOT_FOUND_CODE = "CHAMPIONSHIP_MATCH_REPORT_MATCH_NOT_FOUND";
const MATCH_REPORT_NOT_FOUND_CODE = "CHAMPIONSHIP_MATCH_REPORT_NOT_FOUND";
const MATCH_REPORT_DUPLICATE_CODE = "CHAMPIONSHIP_MATCH_REPORT_DUPLICATE";
const MATCH_REPORT_FINALIZED_CODE = "CHAMPIONSHIP_MATCH_REPORT_FINALIZED";
const MATCH_REPORT_NOT_FINALIZED_CODE = "CHAMPIONSHIP_MATCH_REPORT_NOT_FINALIZED";
const MATCH_REPORT_EVENT_NOT_FOUND_CODE = "CHAMPIONSHIP_MATCH_REPORT_EVENT_NOT_FOUND";
const MATCH_REPORT_TEAM_INVALID_CODE = "CHAMPIONSHIP_MATCH_REPORT_TEAM_INVALID";
const MATCH_REPORT_PLAYER_INVALID_CODE = "CHAMPIONSHIP_MATCH_REPORT_PLAYER_INVALID";
const MATCH_REPORT_SCORE_MISMATCH_CODE = "CHAMPIONSHIP_MATCH_REPORT_SCORE_MISMATCH";

class ChampionshipMatchReportService {
  constructor(options = {}) {
    this.matchReportRepository =
      options.matchReportRepository || options.championshipMatchReportRepository || null;
    this.playerRepository =
      options.playerRepository ||
      options.registrationPlayerRepository ||
      options.championshipRegistrationPlayerRepository ||
      null;
    this.roundService = options.roundService || options.championshipRoundService || null;
    this.statisticsService =
      options.statisticsService || options.championshipStatisticsService || null;
  }

  async create(matchId, input = {}, context = {}) {
    const values = validateCreateChampionshipMatchReportInput(matchId, input);
    const match = await this.requireMatch(values.matchId);
    const existing = await this.getMatchReportRepository().findReportByMatchId(values.matchId);

    if (existing) {
      throw controlledError(
        "Sumula ja cadastrada para este jogo.",
        MATCH_REPORT_DUPLICATE_CODE,
        409,
        {
          matchId: values.matchId,
        },
      );
    }

    const report = await this.getMatchReportRepository().createReport({
      ...values,
      awayScore: match.awayScore ?? 0,
      championshipId: match.championshipId,
      createdBy: readActor(context),
      homeScore: match.homeScore ?? 0,
      status: ChampionshipMatchReportStatus.DRAFT,
      updatedBy: readActor(context),
    });

    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.toReportDto(report, match);
  }

  async findByMatch(matchId) {
    const id = validateChampionshipMatchReportMatchId(matchId);
    const match = await this.requireMatch(id);
    const report = await this.getMatchReportRepository().findReportByMatchId(id);

    return {
      match: normalizeMatch(match),
      report: report ? this.toReportDto(report, match) : null,
    };
  }

  async update(matchId, input = {}, context = {}) {
    const values = validateUpdateChampionshipMatchReportInput(matchId, input);
    const { match, report } = await this.requireEditableReport(values.matchId);
    const updated = await this.getMatchReportRepository().updateReport(report.id, {
      assistantReferee: Object.prototype.hasOwnProperty.call(values, "assistantReferee")
        ? values.assistantReferee
        : undefined,
      observations: Object.prototype.hasOwnProperty.call(values, "observations")
        ? values.observations
        : undefined,
      referee: Object.prototype.hasOwnProperty.call(values, "referee") ? values.referee : undefined,
      scorer: Object.prototype.hasOwnProperty.call(values, "scorer") ? values.scorer : undefined,
      updatedBy: readActor(context),
    });

    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.toReportDto(updated || report, match);
  }

  async open(matchId, context = {}) {
    const id = validateChampionshipMatchReportMatchId(matchId);
    const { match, report } = await this.requireEditableReport(id);
    const updated = await this.getMatchReportRepository().updateReportStatus(report.id, {
      startedAt: report.startedAt || new Date(),
      status: ChampionshipMatchReportStatus.OPEN,
      updatedBy: readActor(context),
    });

    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.toReportDto(updated || report, match);
  }

  async createEvent(matchId, input = {}, context = {}) {
    const values = validateCreateChampionshipMatchEventInput(matchId, input);
    const { match, report } = await this.requireEditableReport(values.matchId);
    const payload = await this.prepareEventPayload(match, values);

    await this.getMatchReportRepository().createEvent({
      ...payload,
      championshipId: report.championshipId,
      createdBy: readActor(context),
      matchId: values.matchId,
      reportId: report.id,
      updatedBy: readActor(context),
    });
    await this.refreshReportScore(report, match, context);
    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.findReportDto(values.matchId);
  }

  async updateEvent(matchId, eventId, input = {}, context = {}) {
    const values = validateUpdateChampionshipMatchEventInput(matchId, eventId, input);
    const { match, report } = await this.requireEditableReport(values.matchId);
    const event = await this.requireEvent(report.id, values.eventId);
    const payload = await this.prepareEventPayload(match, {
      description: Object.prototype.hasOwnProperty.call(values, "description")
        ? values.description
        : event.description,
      eventType: Object.prototype.hasOwnProperty.call(values, "eventType")
        ? values.eventType
        : event.eventType,
      metadata: Object.prototype.hasOwnProperty.call(values, "metadata")
        ? values.metadata
        : event.metadata,
      minute: Object.prototype.hasOwnProperty.call(values, "minute") ? values.minute : event.minute,
      period: Object.prototype.hasOwnProperty.call(values, "period") ? values.period : event.period,
      playerId: Object.prototype.hasOwnProperty.call(values, "playerId")
        ? values.playerId
        : event.playerId,
      relatedPlayerId: Object.prototype.hasOwnProperty.call(values, "relatedPlayerId")
        ? values.relatedPlayerId
        : event.relatedPlayerId,
      teamRegistrationId: Object.prototype.hasOwnProperty.call(values, "teamRegistrationId")
        ? values.teamRegistrationId
        : event.teamRegistrationId,
    });

    await this.getMatchReportRepository().updateEvent(event.id, {
      ...payload,
      updatedBy: readActor(context),
    });
    await this.refreshReportScore(report, match, context);
    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.findReportDto(values.matchId);
  }

  async deleteEvent(matchId, eventId, context = {}) {
    const values = validateDeleteChampionshipMatchEventInput(matchId, eventId);
    const { match, report } = await this.requireEditableReport(values.matchId);
    const event = await this.requireEvent(report.id, values.eventId);

    await this.getMatchReportRepository().deleteEvent(event.id, {
      updatedBy: readActor(context),
    });
    await this.refreshReportScore(report, match, context);
    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.findReportDto(values.matchId);
  }

  async finalize(matchId, input = {}, context = {}) {
    const values = validateFinalizeChampionshipMatchReportInput(matchId, input);
    const { match, report } = await this.requireEditableReport(values.matchId);
    const events = await this.getMatchReportRepository().findEventsByReportId(report.id);
    const calculatedScore = calculateEventScore(match, events);
    const hasWalkover = events.some(
      (event) => event.eventType === ChampionshipMatchEventType.WALKOVER,
    );
    const hasHomeScore = Object.prototype.hasOwnProperty.call(values, "homeScore");
    const hasAwayScore = Object.prototype.hasOwnProperty.call(values, "awayScore");

    if (hasHomeScore !== hasAwayScore) {
      throw controlledError(
        "Informe placar completo para finalizar a sumula.",
        "CHAMPIONSHIP_MATCH_REPORT_SCORE_INCOMPLETE",
        400,
        { matchId: values.matchId },
      );
    }

    const finalScore = {
      awayScore: hasAwayScore ? values.awayScore : calculatedScore.awayScore,
      homeScore: hasHomeScore ? values.homeScore : calculatedScore.homeScore,
    };

    if (
      !hasWalkover &&
      (finalScore.homeScore !== calculatedScore.homeScore ||
        finalScore.awayScore !== calculatedScore.awayScore)
    ) {
      throw controlledError(
        "Placar final diverge dos gols registrados na sumula.",
        MATCH_REPORT_SCORE_MISMATCH_CODE,
        409,
        { calculatedScore, finalScore, matchId: values.matchId },
      );
    }

    await this.getMatchReportRepository().updateReportScore(report.id, {
      awayScore: finalScore.awayScore,
      homeScore: finalScore.homeScore,
      updatedBy: readActor(context),
    });
    await this.getMatchReportRepository().updateReportStatus(report.id, {
      finishedAt: new Date(),
      status: ChampionshipMatchReportStatus.FINISHED,
      updatedBy: readActor(context),
    });
    await this.getRoundService().updateMatch(
      match.championshipId,
      values.matchId,
      {
        awayScore: finalScore.awayScore,
        homeScore: finalScore.homeScore,
        status: ChampionshipMatchStatus.FINISHED,
      },
      context,
    );
    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.findReportDto(values.matchId);
  }

  async reopen(matchId, context = {}) {
    const id = validateChampionshipMatchReportMatchId(matchId);
    const { match, report } = await this.requireReport(id);

    if (report.status !== ChampionshipMatchReportStatus.FINISHED) {
      throw controlledError(
        "Apenas sumulas finalizadas podem ser reabertas.",
        MATCH_REPORT_NOT_FINALIZED_CODE,
        409,
        { matchId: id, status: report.status },
      );
    }

    const updated = await this.getMatchReportRepository().updateReportStatus(report.id, {
      finishedAt: null,
      status: ChampionshipMatchReportStatus.REOPENED,
      updatedBy: readActor(context),
    });

    await this.recalculateStatisticsAfterReportChange(match.championshipId, context);

    return this.toReportDto(updated || report, match);
  }

  async findReportDto(matchId) {
    const { match, report } = await this.requireReport(matchId);
    return this.toReportDto(report, match);
  }

  async requireEditableReport(matchId) {
    const result = await this.requireReport(matchId);

    if (result.report.status === ChampionshipMatchReportStatus.FINISHED) {
      throw controlledError(
        "Sumula finalizada nao pode ser editada sem reabertura.",
        MATCH_REPORT_FINALIZED_CODE,
        409,
        { matchId, status: result.report.status },
      );
    }

    return result;
  }

  async requireReport(matchId) {
    const id = validateChampionshipMatchReportMatchId(matchId);
    const match = await this.requireMatch(id);
    const report = await this.getMatchReportRepository().findReportByMatchId(id);

    if (!report) {
      throw controlledError("Sumula nao encontrada.", MATCH_REPORT_NOT_FOUND_CODE, 404, {
        matchId: id,
      });
    }

    return { match, report };
  }

  async requireMatch(matchId) {
    const match = await this.getMatchReportRepository().findMatchById(matchId);

    if (!match) {
      throw controlledError("Jogo nao encontrado.", MATCH_REPORT_MATCH_NOT_FOUND_CODE, 404, {
        matchId,
      });
    }

    return match;
  }

  async requireEvent(reportId, eventId) {
    const event = await this.getMatchReportRepository().findEventById(reportId, eventId);

    if (!event) {
      throw controlledError(
        "Evento da sumula nao encontrado.",
        MATCH_REPORT_EVENT_NOT_FOUND_CODE,
        404,
        {
          eventId,
          reportId,
        },
      );
    }

    return event;
  }

  async prepareEventPayload(match, values) {
    const teamRegistrationId = values.teamRegistrationId || null;
    const eventType = values.eventType;
    const teamRequired = CHAMPIONSHIP_MATCH_EVENT_TEAM_REQUIRED_TYPES.includes(eventType);
    const playerRequired =
      CHAMPIONSHIP_MATCH_EVENT_PLAYER_REQUIRED_TYPES.includes(eventType) ||
      eventType === ChampionshipMatchEventType.SUBSTITUTION;

    if (teamRequired && !teamRegistrationId) {
      throw controlledError(
        "Equipe do evento e obrigatoria.",
        MATCH_REPORT_TEAM_INVALID_CODE,
        400,
        { eventType },
      );
    }

    if (teamRegistrationId) {
      this.ensureTeamBelongsToMatch(match, teamRegistrationId);
    }

    if (playerRequired && !values.playerId) {
      throw controlledError(
        "Atleta do evento e obrigatorio.",
        MATCH_REPORT_PLAYER_INVALID_CODE,
        400,
        { eventType },
      );
    }

    if (eventType === ChampionshipMatchEventType.SUBSTITUTION && !values.relatedPlayerId) {
      throw controlledError(
        "Atleta substituido e obrigatorio.",
        MATCH_REPORT_PLAYER_INVALID_CODE,
        400,
        { eventType },
      );
    }

    if (values.playerId) {
      await this.ensurePlayerBelongsToRegistration(teamRegistrationId, values.playerId);
    }

    if (values.relatedPlayerId) {
      await this.ensurePlayerBelongsToRegistration(teamRegistrationId, values.relatedPlayerId);
    }

    return {
      description: values.description,
      eventType,
      metadata: values.metadata || {},
      minute: values.minute,
      period: values.period,
      playerId: values.playerId || null,
      relatedPlayerId: values.relatedPlayerId || null,
      teamRegistrationId,
    };
  }

  ensureTeamBelongsToMatch(match, teamRegistrationId) {
    if (
      teamRegistrationId !== match.homeRegistrationId &&
      teamRegistrationId !== match.awayRegistrationId
    ) {
      throw controlledError(
        "Equipe do evento nao pertence ao jogo.",
        MATCH_REPORT_TEAM_INVALID_CODE,
        400,
        {
          awayRegistrationId: match.awayRegistrationId,
          homeRegistrationId: match.homeRegistrationId,
          teamRegistrationId,
        },
      );
    }
  }

  async ensurePlayerBelongsToRegistration(registrationId, playerId) {
    if (!registrationId) {
      throw controlledError(
        "Equipe do atleta e obrigatoria.",
        MATCH_REPORT_TEAM_INVALID_CODE,
        400,
        { playerId },
      );
    }

    const player = await this.getPlayerRepository().findByRegistrationAndId(
      registrationId,
      playerId,
    );

    if (!player || player.active === false) {
      throw controlledError(
        "Atleta nao encontrado na equipe informada.",
        MATCH_REPORT_PLAYER_INVALID_CODE,
        400,
        { playerId, registrationId },
      );
    }

    return player;
  }

  async refreshReportScore(report, match, context = {}) {
    const events = await this.getMatchReportRepository().findEventsByReportId(report.id);
    const hasWalkover = events.some(
      (event) => event.eventType === ChampionshipMatchEventType.WALKOVER,
    );

    if (hasWalkover) return;

    const score = calculateEventScore(match, events);
    await this.getMatchReportRepository().updateReportScore(report.id, {
      ...score,
      updatedBy: readActor(context),
    });
  }

  toReportDto(report, match) {
    return toChampionshipMatchReportAdminDto({
      ...report,
      events: Array.isArray(report.events) ? report.events : [],
      match: normalizeMatch(match || report.match),
    });
  }

  getMatchReportRepository() {
    if (!this.matchReportRepository) {
      throw controlledError(
        "Repositorio de sumulas de campeonato nao configurado.",
        MATCH_REPORT_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.matchReportRepository;
  }

  getPlayerRepository() {
    if (!this.playerRepository) {
      throw controlledError(
        "Repositorio de atletas de inscricao nao configurado.",
        MATCH_REPORT_PLAYER_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.playerRepository;
  }

  getRoundService() {
    if (!this.roundService) {
      throw controlledError(
        "Servico de rodadas nao configurado.",
        MATCH_REPORT_ROUND_SERVICE_REQUIRED_CODE,
        500,
      );
    }

    return this.roundService;
  }

  async recalculateStatisticsAfterReportChange(championshipId, context = {}) {
    if (!this.statisticsService || typeof this.statisticsService.recalculate !== "function") {
      return null;
    }

    return this.statisticsService.recalculate(championshipId, {}, context);
  }
}

function calculateEventScore(match, events = []) {
  const score = {
    awayScore: 0,
    homeScore: 0,
  };

  for (const event of events) {
    if (event.eventType !== ChampionshipMatchEventType.GOAL) continue;

    if (event.teamRegistrationId === match.homeRegistrationId) score.homeScore += 1;
    if (event.teamRegistrationId === match.awayRegistrationId) score.awayScore += 1;
  }

  return score;
}

function normalizeMatch(match) {
  if (!match) return null;
  return typeof match.toJSON === "function" ? match.toJSON() : { ...match };
}

function readActor(context = {}) {
  return (
    context?.auth?.email ||
    context?.auth?.username ||
    context?.user?.email ||
    context?.user?.username ||
    context?.user?.id ||
    null
  );
}

module.exports = {
  ChampionshipMatchReportService,
};
