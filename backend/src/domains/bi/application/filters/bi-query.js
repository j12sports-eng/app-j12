const { resolveBiPeriod } = require("../periods/bi-period.js");

function normalizeBiQuery(input = {}, options = {}) {
  const period = resolveBiPeriod(input, options);
  return Object.freeze({
    ...period,
    unitId: optionalId(input.unitId, "unitId"),
  });
}

function optionalId(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!text || text.length > 64) throw invalidFilter(field);
  return text;
}

function invalidFilter(field) {
  return Object.assign(new TypeError(`BI filter ${field} is invalid.`), {
    code: "BI_FILTER_INVALID",
    details: { field },
  });
}

module.exports = { normalizeBiQuery };
