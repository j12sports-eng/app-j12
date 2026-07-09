const {
  controlledError,
  normalizeLimit,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const CHAMPIONSHIP_GROUP_SORT_FIELDS = Object.freeze(["createdAt", "displayOrder", "name"]);

function validateCreateChampionshipGroupInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    displayOrder: normalizeOptionalInteger(
      readField(input, "displayOrder", "display_order", "ordem"),
      "displayOrder",
    ),
    name: requiredText(readField(input, "name", "nome"), "name", 80),
  };
}

function validateUpdateChampionshipGroupInput(championshipId, groupId, input = {}) {
  const output = {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    groupId: validateChampionshipGroupId(groupId),
  };

  if (hasField(input, "name", "nome")) {
    output.name = requiredText(readField(input, "name", "nome"), "name", 80);
  }

  if (hasField(input, "displayOrder", "display_order", "ordem")) {
    output.displayOrder = normalizeRequiredInteger(
      readField(input, "displayOrder", "display_order", "ordem"),
      "displayOrder",
    );
  }

  return output;
}

function validateChampionshipGroupListInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    limit: normalizeLimit(input.limit, 100),
    page: normalizePage(input.page),
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(
      input.sortBy || input.sort_by,
      CHAMPIONSHIP_GROUP_SORT_FIELDS,
      "displayOrder",
    ),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
  };
}

function validateChampionshipGroupAssignmentInput(championshipId, groupId, input = {}) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    drawPosition: normalizeOptionalInteger(
      readField(input, "drawPosition", "draw_position", "posicao"),
      "drawPosition",
    ),
    groupId: validateChampionshipGroupId(groupId),
    registrationId: requiredText(
      readField(input, "registrationId", "registration_id", "inscricaoId"),
      "registrationId",
      64,
    ),
  };
}

function validateChampionshipGroupMoveInput(championshipId, groupId, registrationId, input = {}) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    drawPosition: normalizeOptionalInteger(
      readField(input, "drawPosition", "draw_position", "posicao"),
      "drawPosition",
    ),
    groupId: validateChampionshipGroupId(groupId),
    registrationId: requiredText(registrationId, "registrationId", 64),
    targetGroupId: validateChampionshipGroupId(
      readField(input, "targetGroupId", "target_group_id", "newGroupId", "grupoDestinoId") ||
        groupId,
    ),
  };
}

function validateChampionshipGroupRegistrationRemovalInput(
  championshipId,
  groupId,
  registrationId,
) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    groupId: validateChampionshipGroupId(groupId),
    registrationId: requiredText(registrationId, "registrationId", 64),
  };
}

function validateChampionshipGroupDrawInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipGroupChampionshipId(championshipId),
    groupCount: normalizeOptionalInteger(
      readField(input, "groupCount", "group_count", "quantidadeGrupos"),
      "groupCount",
    ),
    shuffle: normalizeBoolean(readField(input, "shuffle", "embaralhar", "sortear"), false),
  };
}

function validateChampionshipGroupId(id) {
  return requiredText(id, "groupId", 64);
}

function validateChampionshipGroupChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function normalizeOptionalInteger(value, fieldName) {
  if (nullableText(value, 32) === null) return null;
  return normalizeRequiredInteger(value, fieldName);
}

function normalizeRequiredInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw controlledError(`${fieldName} invalido.`, "CHAMPIONSHIP_GROUP_NUMBER_INVALID", 400, {
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
  validateChampionshipGroupAssignmentInput,
  validateChampionshipGroupChampionshipId,
  validateChampionshipGroupDrawInput,
  validateChampionshipGroupId,
  validateChampionshipGroupListInput,
  validateChampionshipGroupMoveInput,
  validateChampionshipGroupRegistrationRemovalInput,
  validateCreateChampionshipGroupInput,
  validateUpdateChampionshipGroupInput,
};
