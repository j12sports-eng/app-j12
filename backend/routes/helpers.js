const { randomUUID } = require("node:crypto");

function sanitizeString(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function sanitizeNullableString(value, max = 65535) {
  const sanitized = sanitizeString(value, max);
  return sanitized || null;
}

function sanitizeNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : fallback;
}

function sanitizeInteger(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function sanitizeArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => sanitizeString(item, 191))
        .filter(Boolean),
    ),
  );
}

function parseJson(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return JSON.stringify(value ?? null);
}

function sanitizeIsoDate(value) {
  const sanitized = sanitizeString(value, 10);
  if (!sanitized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(sanitized) ? sanitized : null;
}

function createId(prefix) {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

module.exports = {
  sanitizeString,
  sanitizeNullableString,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeBoolean,
  sanitizeArray,
  parseJson,
  stringifyJson,
  sanitizeIsoDate,
  createId,
};
