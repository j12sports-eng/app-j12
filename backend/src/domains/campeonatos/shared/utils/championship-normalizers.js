const { randomUUID } = require("node:crypto");

const { ChampionshipStatus, CHAMPIONSHIP_STATUSES } = require("../enums/index.js");

function text(value, maxLength = 191) {
  const normalized = String(value ?? "").trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function nullableText(value, maxLength = 191) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function requiredText(value, fieldName, maxLength = 191) {
  const normalized = text(value, maxLength);

  if (!normalized) {
    throw controlledError(`${fieldName} e obrigatorio.`, "CHAMPIONSHIP_INPUT_REQUIRED", 400, {
      field: fieldName,
    });
  }

  return normalized;
}

function normalizeDate(value, fieldName, { required = false } = {}) {
  const normalized = text(value, 32);

  if (!normalized) {
    if (required) {
      throw controlledError(`${fieldName} e obrigatorio.`, "CHAMPIONSHIP_INPUT_REQUIRED", 400, {
        field: fieldName,
      });
    }

    return null;
  }

  const date = normalized.length === 10 ? new Date(`${normalized}T00:00:00`) : new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw controlledError(`${fieldName} invalido.`, "CHAMPIONSHIP_DATE_INVALID", 400, {
      field: fieldName,
      value: normalized,
    });
  }

  return toDateOnly(date);
}

function normalizeDateRange(startDate, endDate) {
  if (startDate && endDate && new Date(`${startDate}T00:00:00`) > new Date(`${endDate}T00:00:00`)) {
    throw controlledError(
      "Data final deve ser igual ou posterior a data inicial.",
      "CHAMPIONSHIP_DATE_RANGE_INVALID",
      400,
      { endDate, startDate },
    );
  }
}

function normalizeChampionshipStatus(value, fallback = ChampionshipStatus.DRAFT) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["RASCUNHO", "DRAFT"].includes(normalized)) return ChampionshipStatus.DRAFT;
  if (["PUBLICADO", "PUBLICADA", "PUBLISHED"].includes(normalized)) {
    return ChampionshipStatus.PUBLISHED;
  }
  if (["ARQUIVADO", "ARQUIVADA", "ARCHIVED"].includes(normalized)) {
    return ChampionshipStatus.ARCHIVED;
  }
  if (["REMOVIDO", "REMOVIDA", "REMOVED", "DELETED"].includes(normalized)) {
    return ChampionshipStatus.REMOVED;
  }

  if (CHAMPIONSHIP_STATUSES.includes(normalized)) return normalized;

  throw controlledError("Status de campeonato invalido.", "CHAMPIONSHIP_STATUS_INVALID", 400, {
    status: value,
  });
}

function normalizeLimit(value, fallback = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 500);
}

function readRows(result) {
  if (Array.isArray(result?.[0])) return result[0];
  return Array.isArray(result) ? result : [];
}

function readFirstRow(result) {
  return readRows(result)[0] || null;
}

function readObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function createId(prefix = "champ") {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function toDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function controlledError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.errorCode = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

module.exports = {
  controlledError,
  createId,
  normalizeChampionshipStatus,
  normalizeDate,
  normalizeDateRange,
  normalizeLimit,
  nullableText,
  readFirstRow,
  readObject,
  readRows,
  requiredText,
  text,
  toDateOnly,
};
