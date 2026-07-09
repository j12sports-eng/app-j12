const {
  CHAMPIONSHIP_MATCH_STATUSES,
  CHAMPIONSHIP_ROUND_PHASES,
  ChampionshipMatchStatus,
  ChampionshipRoundPhase,
} = require("../../shared/constants/index.js");
const {
  controlledError,
  normalizeDate,
  normalizeLimit,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const CHAMPIONSHIP_ROUND_SORT_FIELDS = Object.freeze(["createdAt", "name", "roundNumber"]);
const CHAMPIONSHIP_MATCH_SORT_FIELDS = Object.freeze([
  "court",
  "createdAt",
  "matchDate",
  "roundNumber",
  "startTime",
  "status",
]);

function validateCreateChampionshipRoundInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    name: nullableText(readField(input, "name", "nome"), 80),
    phase: normalizeRoundPhase(readField(input, "phase", "fase")),
    roundNumber: normalizeOptionalPositiveInteger(
      readField(input, "roundNumber", "round_number", "numeroRodada", "numero"),
      "roundNumber",
    ),
  };
}

function validateUpdateChampionshipRoundInput(championshipId, roundId, input = {}) {
  const output = {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    roundId: validateChampionshipRoundId(roundId),
  };

  if (hasField(input, "name", "nome")) {
    output.name = requiredText(readField(input, "name", "nome"), "name", 80);
  }

  if (hasField(input, "phase", "fase")) {
    output.phase = normalizeRoundPhase(readField(input, "phase", "fase"));
  }

  if (hasField(input, "roundNumber", "round_number", "numeroRodada", "numero")) {
    output.roundNumber = normalizeRequiredPositiveInteger(
      readField(input, "roundNumber", "round_number", "numeroRodada", "numero"),
      "roundNumber",
    );
  }

  return output;
}

function validateChampionshipRoundListInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    limit: normalizeLimit(input.limit, 100),
    page: normalizePage(input.page),
    phase: input.phase || input.fase ? normalizeRoundPhase(input.phase || input.fase) : "",
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(
      input.sortBy || input.sort_by,
      CHAMPIONSHIP_ROUND_SORT_FIELDS,
      "roundNumber",
    ),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
  };
}

function validateCreateChampionshipMatchInput(championshipId, roundId, input = {}) {
  const output = {
    awayRegistrationId: requiredText(
      readField(input, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId"),
      "awayRegistrationId",
      64,
    ),
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    court: nullableText(readField(input, "court", "quadra"), 120),
    groupId: requiredText(readField(input, "groupId", "group_id", "grupoId"), "groupId", 64),
    homeRegistrationId: requiredText(
      readField(input, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId"),
      "homeRegistrationId",
      64,
    ),
    matchDate: normalizeOptionalDate(readField(input, "matchDate", "match_date", "dataJogo")),
    roundId: validateChampionshipRoundId(roundId),
    startTime: normalizeOptionalTime(readField(input, "startTime", "start_time", "horaInicio")),
    status: normalizeMatchStatus(readField(input, "status"), ChampionshipMatchStatus.SCHEDULED),
  };

  if (hasField(input, "homeScore", "home_score", "golsMandante", "mandanteGols")) {
    output.homeScore = normalizeOptionalScore(
      readField(input, "homeScore", "home_score", "golsMandante", "mandanteGols"),
      "homeScore",
    );
  }

  if (hasField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols")) {
    output.awayScore = normalizeOptionalScore(
      readField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols"),
      "awayScore",
    );
  }

  return output;
}

function validateUpdateChampionshipMatchInput(championshipId, matchId, input = {}) {
  const output = {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    matchId: validateChampionshipMatchId(matchId),
  };

  if (hasField(input, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId")) {
    output.awayRegistrationId = requiredText(
      readField(input, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId"),
      "awayRegistrationId",
      64,
    );
  }

  if (hasField(input, "court", "quadra")) {
    output.court = nullableText(readField(input, "court", "quadra"), 120);
  }

  if (hasField(input, "groupId", "group_id", "grupoId")) {
    output.groupId = requiredText(
      readField(input, "groupId", "group_id", "grupoId"),
      "groupId",
      64,
    );
  }

  if (hasField(input, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId")) {
    output.homeRegistrationId = requiredText(
      readField(input, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId"),
      "homeRegistrationId",
      64,
    );
  }

  if (hasField(input, "homeScore", "home_score", "golsMandante", "mandanteGols")) {
    output.homeScore = normalizeOptionalScore(
      readField(input, "homeScore", "home_score", "golsMandante", "mandanteGols"),
      "homeScore",
    );
  }

  if (hasField(input, "matchDate", "match_date", "dataJogo")) {
    output.matchDate = normalizeOptionalDate(
      readField(input, "matchDate", "match_date", "dataJogo"),
    );
  }

  if (hasField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols")) {
    output.awayScore = normalizeOptionalScore(
      readField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols"),
      "awayScore",
    );
  }

  if (hasField(input, "startTime", "start_time", "horaInicio")) {
    output.startTime = normalizeOptionalTime(
      readField(input, "startTime", "start_time", "horaInicio"),
    );
  }

  if (hasField(input, "status")) {
    output.status = normalizeMatchStatus(readField(input, "status"));
  }

  return output;
}

function validateChampionshipMatchListInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    groupId: nullableText(input.groupId || input.group_id || input.grupoId, 64),
    limit: normalizeLimit(input.limit, 100),
    page: normalizePage(input.page),
    phase: input.phase || input.fase ? normalizeRoundPhase(input.phase || input.fase) : "",
    roundId: nullableText(input.roundId || input.round_id || input.rodadaId, 64),
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(
      input.sortBy || input.sort_by,
      CHAMPIONSHIP_MATCH_SORT_FIELDS,
      "roundNumber",
    ),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
    status: input.status ? normalizeMatchStatus(input.status) : "",
  };
}

function validateMoveChampionshipMatchInput(championshipId, matchId, input = {}) {
  return {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    matchId: validateChampionshipMatchId(matchId),
    targetRoundId: validateChampionshipRoundId(
      readField(input, "targetRoundId", "target_round_id", "roundId", "rodadaDestinoId"),
    ),
  };
}

function validateGenerateChampionshipMatchesInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipRoundChampionshipId(championshipId),
    phase: normalizeRoundPhase(readField(input, "phase", "fase")),
    replace: normalizeBoolean(readField(input, "replace", "substituir", "refazer"), false),
  };
}

function validateChampionshipRoundId(id) {
  return requiredText(id, "roundId", 64);
}

function validateChampionshipMatchId(id) {
  return requiredText(id, "matchId", 64);
}

function validateChampionshipRoundChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function normalizeRoundPhase(value, fallback = ChampionshipRoundPhase.GROUP_STAGE) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["GRUPOS", "FASE_GRUPOS", "FASE_DE_GRUPOS", "GROUPS", "GROUP_STAGE"].includes(normalized)) {
    return ChampionshipRoundPhase.GROUP_STAGE;
  }

  if (CHAMPIONSHIP_ROUND_PHASES.includes(normalized)) return normalized;

  throw controlledError("Fase de rodada invalida.", "CHAMPIONSHIP_ROUND_PHASE_INVALID", 400, {
    phase: value,
  });
}

function normalizeMatchStatus(value, fallback = ChampionshipMatchStatus.SCHEDULED) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["AGENDADO", "AGENDADA", "SCHEDULED"].includes(normalized)) {
    return ChampionshipMatchStatus.SCHEDULED;
  }
  if (["ADIADO", "ADIADA", "POSTPONED"].includes(normalized)) {
    return ChampionshipMatchStatus.POSTPONED;
  }
  if (["CANCELADO", "CANCELADA", "CANCELLED", "CANCELED"].includes(normalized)) {
    return ChampionshipMatchStatus.CANCELLED;
  }
  if (["ENCERRADO", "ENCERRADA", "FINALIZADO", "FINALIZADA", "FINISHED"].includes(normalized)) {
    return ChampionshipMatchStatus.FINISHED;
  }

  if (CHAMPIONSHIP_MATCH_STATUSES.includes(normalized)) return normalized;

  throw controlledError("Status de jogo invalido.", "CHAMPIONSHIP_MATCH_STATUS_INVALID", 400, {
    status: value,
  });
}

function normalizeOptionalDate(value) {
  if (nullableText(value, 32) === null) return null;
  return normalizeDate(value, "matchDate", { required: false });
}

function normalizeOptionalTime(value) {
  const normalized = nullableText(value, 16);
  if (normalized === null) return null;

  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    throw controlledError("Horario do jogo invalido.", "CHAMPIONSHIP_MATCH_TIME_INVALID", 400, {
      value,
    });
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw controlledError("Horario do jogo invalido.", "CHAMPIONSHIP_MATCH_TIME_INVALID", 400, {
      value,
    });
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (nullableText(value, 32) === null) return null;
  return normalizeRequiredPositiveInteger(value, fieldName);
}

function normalizeRequiredPositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw controlledError(`${fieldName} invalido.`, "CHAMPIONSHIP_ROUND_NUMBER_INVALID", 400, {
      field: fieldName,
      value,
    });
  }

  return Math.trunc(parsed);
}

function normalizeOptionalScore(value, fieldName) {
  if (nullableText(value, 32) === null) return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw controlledError(`${fieldName} invalido.`, "CHAMPIONSHIP_MATCH_SCORE_INVALID", 400, {
      field: fieldName,
      value,
    });
  }

  return Math.trunc(parsed);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value, 20)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["1", "SIM", "S", "TRUE", "YES", "Y"].includes(normalized)) return true;
  if (["0", "NAO", "N", "FALSE", "NO"].includes(normalized)) return false;

  return fallback;
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function normalizeSortDirection(value) {
  const normalized = text(value, 8).toUpperCase();
  return normalized === "DESC" ? "DESC" : "ASC";
}

function normalizeSortField(value, allowedFields, fallback) {
  const normalized = text(value, 64);
  return allowedFields.includes(normalized) ? normalized : fallback;
}

function hasField(source, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function readField(source, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

module.exports = {
  normalizeMatchStatus,
  normalizeRoundPhase,
  validateChampionshipMatchId,
  validateChampionshipMatchListInput,
  validateChampionshipRoundChampionshipId,
  validateChampionshipRoundId,
  validateCreateChampionshipMatchInput,
  validateCreateChampionshipRoundInput,
  validateGenerateChampionshipMatchesInput,
  validateMoveChampionshipMatchInput,
  validateUpdateChampionshipMatchInput,
  validateUpdateChampionshipRoundInput,
  validateChampionshipRoundListInput,
};
