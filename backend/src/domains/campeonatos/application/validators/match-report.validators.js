const {
  CHAMPIONSHIP_MATCH_EVENT_TYPES,
  CHAMPIONSHIP_MATCH_REPORT_STATUSES,
  ChampionshipMatchEventType,
  ChampionshipMatchReportStatus,
} = require("../../shared/constants/index.js");
const {
  controlledError,
  nullableText,
  readObject,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

function validateCreateChampionshipMatchReportInput(matchId, input = {}) {
  return {
    assistantReferee: nullableText(readField(input, "assistantReferee", "arbitroAssistente"), 191),
    matchId: validateChampionshipMatchReportMatchId(matchId),
    observations: nullableText(readField(input, "observations", "observacoes"), 2000),
    referee: nullableText(readField(input, "referee", "arbitro"), 191),
    scorer: nullableText(readField(input, "scorer", "anotador"), 191),
  };
}

function validateUpdateChampionshipMatchReportInput(matchId, input = {}) {
  const output = {
    matchId: validateChampionshipMatchReportMatchId(matchId),
  };

  if (hasField(input, "assistantReferee", "arbitroAssistente")) {
    output.assistantReferee = nullableText(
      readField(input, "assistantReferee", "arbitroAssistente"),
      191,
    );
  }

  if (hasField(input, "observations", "observacoes")) {
    output.observations = nullableText(readField(input, "observations", "observacoes"), 2000);
  }

  if (hasField(input, "referee", "arbitro")) {
    output.referee = nullableText(readField(input, "referee", "arbitro"), 191);
  }

  if (hasField(input, "scorer", "anotador")) {
    output.scorer = nullableText(readField(input, "scorer", "anotador"), 191);
  }

  return output;
}

function validateCreateChampionshipMatchEventInput(matchId, input = {}) {
  return {
    description: nullableText(readField(input, "description", "descricao", "observations"), 2000),
    eventType: normalizeEventType(readField(input, "eventType", "event_type", "tipo")),
    matchId: validateChampionshipMatchReportMatchId(matchId),
    metadata: normalizeMetadata(readField(input, "metadata", "metadataJson", "dados")),
    minute: normalizeMinute(readField(input, "minute", "minuto")),
    period: nullableText(readField(input, "period", "periodo", "tempo"), 32),
    playerId: nullableText(readField(input, "playerId", "player_id", "atletaId"), 64),
    relatedPlayerId: nullableText(
      readField(input, "relatedPlayerId", "related_player_id", "atletaRelacionadoId", "saiuId"),
      64,
    ),
    teamRegistrationId: nullableText(
      readField(input, "teamRegistrationId", "team_registration_id", "inscricaoEquipeId"),
      64,
    ),
  };
}

function validateUpdateChampionshipMatchEventInput(matchId, eventId, input = {}) {
  const output = {
    eventId: validateChampionshipMatchReportEventId(eventId),
    matchId: validateChampionshipMatchReportMatchId(matchId),
  };

  if (hasField(input, "description", "descricao", "observations")) {
    output.description = nullableText(
      readField(input, "description", "descricao", "observations"),
      2000,
    );
  }

  if (hasField(input, "eventType", "event_type", "tipo")) {
    output.eventType = normalizeEventType(readField(input, "eventType", "event_type", "tipo"));
  }

  if (hasField(input, "metadata", "metadataJson", "dados")) {
    output.metadata = normalizeMetadata(readField(input, "metadata", "metadataJson", "dados"));
  }

  if (hasField(input, "minute", "minuto")) {
    output.minute = normalizeMinute(readField(input, "minute", "minuto"));
  }

  if (hasField(input, "period", "periodo", "tempo")) {
    output.period = nullableText(readField(input, "period", "periodo", "tempo"), 32);
  }

  if (hasField(input, "playerId", "player_id", "atletaId")) {
    output.playerId = nullableText(readField(input, "playerId", "player_id", "atletaId"), 64);
  }

  if (hasField(input, "relatedPlayerId", "related_player_id", "atletaRelacionadoId", "saiuId")) {
    output.relatedPlayerId = nullableText(
      readField(input, "relatedPlayerId", "related_player_id", "atletaRelacionadoId", "saiuId"),
      64,
    );
  }

  if (hasField(input, "teamRegistrationId", "team_registration_id", "inscricaoEquipeId")) {
    output.teamRegistrationId = nullableText(
      readField(input, "teamRegistrationId", "team_registration_id", "inscricaoEquipeId"),
      64,
    );
  }

  return output;
}

function validateDeleteChampionshipMatchEventInput(matchId, eventId) {
  return {
    eventId: validateChampionshipMatchReportEventId(eventId),
    matchId: validateChampionshipMatchReportMatchId(matchId),
  };
}

function validateFinalizeChampionshipMatchReportInput(matchId, input = {}) {
  const output = {
    matchId: validateChampionshipMatchReportMatchId(matchId),
  };

  if (hasField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols")) {
    output.awayScore = normalizeRequiredScore(
      readField(input, "awayScore", "away_score", "golsVisitante", "visitanteGols"),
      "awayScore",
    );
  }

  if (hasField(input, "homeScore", "home_score", "golsMandante", "mandanteGols")) {
    output.homeScore = normalizeRequiredScore(
      readField(input, "homeScore", "home_score", "golsMandante", "mandanteGols"),
      "homeScore",
    );
  }

  return output;
}

function validateChampionshipMatchReportMatchId(id) {
  return requiredText(id, "matchId", 64);
}

function validateChampionshipMatchReportEventId(id) {
  return requiredText(id, "eventId", 64);
}

function normalizeReportStatus(value, fallback = ChampionshipMatchReportStatus.DRAFT) {
  const normalized = normalizeToken(value);

  if (!normalized) return fallback;
  if (["RASCUNHO", "DRAFT"].includes(normalized)) return ChampionshipMatchReportStatus.DRAFT;
  if (["ABERTA", "ABERTO", "EM_ANDAMENTO", "OPEN"].includes(normalized)) {
    return ChampionshipMatchReportStatus.OPEN;
  }
  if (["FINALIZADA", "FINALIZADO", "FINISHED"].includes(normalized)) {
    return ChampionshipMatchReportStatus.FINISHED;
  }
  if (["REABERTA", "REABERTO", "REOPENED"].includes(normalized)) {
    return ChampionshipMatchReportStatus.REOPENED;
  }

  if (CHAMPIONSHIP_MATCH_REPORT_STATUSES.includes(normalized)) return normalized;

  throw controlledError(
    "Status de sumula invalido.",
    "CHAMPIONSHIP_MATCH_REPORT_STATUS_INVALID",
    400,
    { status: value },
  );
}

function normalizeEventType(value) {
  const normalized = normalizeToken(value);

  if (["GOL", "GOAL"].includes(normalized)) return ChampionshipMatchEventType.GOAL;
  if (["CARTAO_AMARELO", "YELLOW_CARD"].includes(normalized)) {
    return ChampionshipMatchEventType.YELLOW_CARD;
  }
  if (["CARTAO_VERMELHO", "RED_CARD"].includes(normalized)) {
    return ChampionshipMatchEventType.RED_CARD;
  }
  if (["FALTA", "FOUL"].includes(normalized)) return ChampionshipMatchEventType.FOUL;
  if (["SUBSTITUICAO", "SUBSTITUTION"].includes(normalized)) {
    return ChampionshipMatchEventType.SUBSTITUTION;
  }
  if (["TEMPO_TECNICO", "PEDIDO_DE_TEMPO", "TECHNICAL_TIMEOUT"].includes(normalized)) {
    return ChampionshipMatchEventType.TECHNICAL_TIMEOUT;
  }
  if (["OBSERVACAO", "OBSERVATION"].includes(normalized)) {
    return ChampionshipMatchEventType.OBSERVATION;
  }
  if (["WO", "W_O", "WALKOVER"].includes(normalized)) return ChampionshipMatchEventType.WALKOVER;

  if (CHAMPIONSHIP_MATCH_EVENT_TYPES.includes(normalized)) return normalized;

  throw controlledError("Tipo de evento invalido.", "CHAMPIONSHIP_MATCH_EVENT_TYPE_INVALID", 400, {
    eventType: value,
  });
}

function normalizeMinute(value) {
  if (nullableText(value, 32) === null) return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw controlledError(
      "Minuto do evento invalido.",
      "CHAMPIONSHIP_MATCH_EVENT_MINUTE_INVALID",
      400,
      {
        value,
      },
    );
  }

  return Math.trunc(parsed);
}

function normalizeRequiredScore(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw controlledError(
      `${fieldName} invalido.`,
      "CHAMPIONSHIP_MATCH_REPORT_SCORE_INVALID",
      400,
      {
        field: fieldName,
        value,
      },
    );
  }

  return Math.trunc(parsed);
}

function normalizeMetadata(value) {
  if (value === null || typeof value === "undefined" || value === "") return {};
  return readObject(value);
}

function normalizeToken(value) {
  return text(value, 64)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[./\s-]+/g, "_")
    .toUpperCase();
}

function hasField(input, ...fieldNames) {
  return fieldNames.some((fieldName) => Object.prototype.hasOwnProperty.call(input, fieldName));
}

function readField(input, ...fieldNames) {
  for (const fieldName of fieldNames) {
    if (Object.prototype.hasOwnProperty.call(input, fieldName)) return input[fieldName];
  }

  return undefined;
}

module.exports = {
  normalizeReportStatus,
  validateChampionshipMatchReportEventId,
  validateChampionshipMatchReportMatchId,
  validateCreateChampionshipMatchEventInput,
  validateCreateChampionshipMatchReportInput,
  validateDeleteChampionshipMatchEventInput,
  validateFinalizeChampionshipMatchReportInput,
  validateUpdateChampionshipMatchEventInput,
  validateUpdateChampionshipMatchReportInput,
};
