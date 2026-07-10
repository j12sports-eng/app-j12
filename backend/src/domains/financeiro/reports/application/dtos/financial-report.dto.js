function toFinancialReportDto(input = {}) {
  return {
    filters: input.filters || {},
    generatedAt: input.generatedAt || new Date().toISOString(),
    report: input.report || "unknown",
    ...normalizeValue(input.data || {}),
  };
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeField(key, item)]),
  );
}

function normalizeField(key, value) {
  if (Array.isArray(value) || (value && typeof value === "object")) return normalizeValue(value);
  if (/amount|balance|revenue|expense|total|valor|saldo|receita|despesa|percent|taxa/i.test(key)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }
  if (/count|quantity|page|limit/i.test(key)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return value ?? null;
}

module.exports = { normalizeValue, toFinancialReportDto };
