const {
  CHAMPIONSHIP_BRACKET_MODES,
  CHAMPIONSHIP_BRACKET_PHASES,
  CHAMPIONSHIP_BRACKET_SLOTS,
  CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE,
  CHAMPIONSHIP_MATCH_STATUSES,
  ChampionshipBracketMode,
  ChampionshipBracketPhase,
  ChampionshipBracketSlot,
  ChampionshipMatchStatus,
} = require("../../shared/constants/index.js");
const {
  controlledError,
  normalizeDate,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const VALID_TEAM_COUNTS = Object.freeze([2, 4, 8, 16, 32]);

function validateGenerateChampionshipBracketInput(championshipId, input = {}) {
  const mode = normalizeBracketMode(readField(input, "mode", "modo"));
  const initialPhase = hasField(input, "initialPhase", "phase", "faseInicial", "fase")
    ? normalizeBracketPhase(readField(input, "initialPhase", "phase", "faseInicial", "fase"))
    : "";
  const teamCount = normalizeBracketTeamCount(
    readField(input, "teamCount", "quantidadeEquipes", "equipes"),
    initialPhase,
  );
  const normalizedPhase =
    initialPhase || phaseByTeamCount(teamCount) || ChampionshipBracketPhase.SEMI_FINAL;

  return {
    championshipId: validateChampionshipBracketChampionshipId(championshipId),
    includeThirdPlace: normalizeBoolean(
      readField(input, "includeThirdPlace", "terceiroLugar", "disputaTerceiro"),
      false,
    ),
    initialPhase: normalizedPhase,
    manualMatches: normalizeManualMatches(readField(input, "manualMatches", "matches", "jogos")),
    mode,
    replace: normalizeBoolean(readField(input, "replace", "substituir", "refazer"), false),
    teamCount: teamCount || CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE[normalizedPhase],
  };
}

function validateChampionshipBracketPhaseInput(championshipId, phase) {
  return {
    championshipId: validateChampionshipBracketChampionshipId(championshipId),
    phase: normalizeBracketPhase(phase),
  };
}

function validateUpdateChampionshipBracketMatchInput(matchId, input = {}) {
  const output = {
    matchId: validateChampionshipBracketMatchId(matchId),
  };

  if (hasField(input, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId")) {
    output.awayRegistrationId = nullableText(
      readField(input, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId"),
      64,
    );
  }

  if (hasField(input, "court", "quadra")) {
    output.court = nullableText(readField(input, "court", "quadra"), 120);
  }

  if (hasField(input, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId")) {
    output.homeRegistrationId = nullableText(
      readField(input, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId"),
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

  if (hasField(input, "winnerRegistrationId", "winner_registration_id", "vencedorInscricaoId")) {
    output.winnerRegistrationId = nullableText(
      readField(input, "winnerRegistrationId", "winner_registration_id", "vencedorInscricaoId"),
      64,
    );
  }

  return output;
}

function validateAdvanceChampionshipBracketMatchInput(matchId, input = {}) {
  return {
    matchId: validateChampionshipBracketMatchId(matchId),
    winnerRegistrationId: nullableText(
      readField(input, "winnerRegistrationId", "winner_registration_id", "vencedorInscricaoId"),
      64,
    ),
  };
}

function validateChampionshipBracketChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function validateChampionshipBracketMatchId(id) {
  return requiredText(id, "matchId", 64);
}

function normalizeBracketMode(value, fallback = ChampionshipBracketMode.AUTOMATIC) {
  const normalized = normalizeToken(value);

  if (!normalized) return fallback;
  if (["AUTOMATICO", "AUTOMATICA", "AUTO", "AUTOMATIC"].includes(normalized)) {
    return ChampionshipBracketMode.AUTOMATIC;
  }
  if (["MANUAL"].includes(normalized)) return ChampionshipBracketMode.MANUAL;
  if (CHAMPIONSHIP_BRACKET_MODES.includes(normalized)) return normalized;

  throw controlledError("Modo de mata-mata invalido.", "CHAMPIONSHIP_BRACKET_MODE_INVALID", 400, {
    mode: value,
  });
}

function normalizeBracketPhase(value, fallback = null) {
  const normalized = normalizeToken(value);

  if (!normalized) {
    if (fallback) return fallback;
    throw controlledError(
      "Fase do mata-mata e obrigatoria.",
      "CHAMPIONSHIP_BRACKET_PHASE_REQUIRED",
      400,
    );
  }

  if (["16_AVOS", "DEZESSEIS_AVOS", "ROUND_OF_32"].includes(normalized)) {
    return ChampionshipBracketPhase.ROUND_OF_32;
  }
  if (["OITAVAS", "OITAVAS_DE_FINAL", "ROUND_OF_16"].includes(normalized)) {
    return ChampionshipBracketPhase.ROUND_OF_16;
  }
  if (["QUARTAS", "QUARTAS_DE_FINAL", "QUARTER_FINAL"].includes(normalized)) {
    return ChampionshipBracketPhase.QUARTER_FINAL;
  }
  if (["SEMI", "SEMIFINAL", "SEMI_FINAL", "SEMIFINALS"].includes(normalized)) {
    return ChampionshipBracketPhase.SEMI_FINAL;
  }
  if (["TERCEIRO", "TERCEIRO_LUGAR", "THIRD_PLACE"].includes(normalized)) {
    return ChampionshipBracketPhase.THIRD_PLACE;
  }
  if (["FINAL"].includes(normalized)) return ChampionshipBracketPhase.FINAL;
  if (CHAMPIONSHIP_BRACKET_PHASES.includes(normalized)) return normalized;

  throw controlledError("Fase do mata-mata invalida.", "CHAMPIONSHIP_BRACKET_PHASE_INVALID", 400, {
    phase: value,
  });
}

function normalizeBracketSlot(value, fallback = null) {
  const normalized = normalizeToken(value);

  if (!normalized) return fallback;
  if (["MANDANTE", "CASA", "HOME"].includes(normalized)) return ChampionshipBracketSlot.HOME;
  if (["VISITANTE", "FORA", "AWAY"].includes(normalized)) return ChampionshipBracketSlot.AWAY;
  if (CHAMPIONSHIP_BRACKET_SLOTS.includes(normalized)) return normalized;

  throw controlledError("Slot do mata-mata invalido.", "CHAMPIONSHIP_BRACKET_SLOT_INVALID", 400, {
    slot: value,
  });
}

function normalizeMatchStatus(value, fallback = ChampionshipMatchStatus.SCHEDULED) {
  const normalized = normalizeToken(value);

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

function normalizeManualMatches(value) {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => ({
    awayRegistrationId: nullableText(
      readField(item || {}, "awayRegistrationId", "away_registration_id", "visitanteInscricaoId"),
      64,
    ),
    displayOrder: normalizeDisplayOrder(
      readField(item || {}, "displayOrder", "ordem", "posicao"),
      index + 1,
    ),
    homeRegistrationId: nullableText(
      readField(item || {}, "homeRegistrationId", "home_registration_id", "mandanteInscricaoId"),
      64,
    ),
  }));
}

function normalizeBracketTeamCount(value, initialPhase) {
  const phaseTeamCount =
    initialPhase && CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE[initialPhase]
      ? CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE[initialPhase]
      : null;

  if (nullableText(value, 32) === null) return phaseTeamCount;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !VALID_TEAM_COUNTS.includes(Math.trunc(parsed))) {
    throw controlledError(
      "Quantidade de equipes do mata-mata invalida.",
      "CHAMPIONSHIP_BRACKET_TEAM_COUNT_INVALID",
      400,
      { teamCount: value },
    );
  }

  const teamCount = Math.trunc(parsed);
  if (phaseTeamCount && phaseTeamCount !== teamCount) {
    throw controlledError(
      "Fase inicial e quantidade de equipes do mata-mata sao incompativeis.",
      "CHAMPIONSHIP_BRACKET_TEAM_COUNT_PHASE_MISMATCH",
      400,
      { initialPhase, teamCount },
    );
  }

  return teamCount;
}

function phaseByTeamCount(teamCount) {
  for (const [count, phase] of Object.entries(CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE)) {
    if (Number(count) === Number(teamCount)) return phase;
  }

  return "";
}

function normalizeDisplayOrder(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
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
  const normalized = normalizeToken(value);

  if (!normalized) return fallback;
  if (["1", "SIM", "S", "TRUE", "YES", "Y"].includes(normalized)) return true;
  if (["0", "NAO", "N", "FALSE", "NO"].includes(normalized)) return false;

  return fallback;
}

function normalizeToken(value) {
  return text(value, 64)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();
}

function hasField(source, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source || {}, key));
}

function readField(source, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source || {}, key)) {
      return source[key];
    }
  }

  return undefined;
}

module.exports = {
  normalizeBracketMode,
  normalizeBracketPhase,
  normalizeBracketSlot,
  normalizeMatchStatus,
  validateAdvanceChampionshipBracketMatchInput,
  validateChampionshipBracketChampionshipId,
  validateChampionshipBracketMatchId,
  validateChampionshipBracketPhaseInput,
  validateGenerateChampionshipBracketInput,
  validateUpdateChampionshipBracketMatchInput,
};
