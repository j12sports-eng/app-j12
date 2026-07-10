const AutomationErrorCategory = Object.freeze({
  BUSINESS: "Business",
  INFRASTRUCTURE: "Infrastructure",
  INTEGRATION: "Integration",
  TIMEOUT: "Timeout",
  UNEXPECTED: "Unexpected",
  VALIDATION: "Validation",
});

class AutomationError extends Error {
  constructor(message, options = {}) {
    super(message || "Financial automation orchestration failed.", {
      cause: options.cause,
    });
    this.name = "AutomationError";
    this.category = normalizeCategory(options.category);
    this.code = normalizeText(options.code, 120) || "AUTOMATION_UNEXPECTED_ERROR";
    this.details = sanitizeDetails(options.details);
  }

  toJSON() {
    return {
      category: this.category,
      code: this.code,
      details: this.details,
      message: this.message,
    };
  }

  static from(error, fallback = {}) {
    if (error instanceof AutomationError) return error;

    const category = resolveCategory(error, fallback.category);
    return new AutomationError(fallback.message || "Financial automation orchestration failed.", {
      category,
      cause: error,
      code: normalizeText(error?.code, 120) || fallback.code || categoryCode(category),
      details: fallback.details,
    });
  }
}

function resolveCategory(error, fallbackCategory) {
  const chain = errorChain(error);
  const codes = chain.map((item) => String(item?.code || "").toUpperCase());
  const names = chain.map((item) => String(item?.name || "").toUpperCase());

  if (
    codes.some((code) => ["ETIMEDOUT", "TIMEOUT", "ABORT_ERR"].includes(code)) ||
    names.includes("ABORTERROR")
  ) {
    return AutomationErrorCategory.TIMEOUT;
  }
  if (codes.some((code) => /VALIDATION|INVALID|REQUIRED/.test(code))) {
    return AutomationErrorCategory.VALIDATION;
  }
  if (codes.some((code) => /ECONNREFUSED|ENOTFOUND|TRANSPORT/.test(code))) {
    return AutomationErrorCategory.INFRASTRUCTURE;
  }
  if (codes.some((code) => /N8N|INTEGRATION/.test(code))) {
    return AutomationErrorCategory.INTEGRATION;
  }
  if (
    chain.some((item) => String(item?.category || item?.type || "").toLowerCase() === "business")
  ) {
    return AutomationErrorCategory.BUSINESS;
  }
  return normalizeCategory(fallbackCategory);
}

function errorChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current) && chain.length < 8) {
    seen.add(current);
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

function normalizeCategory(value) {
  return Object.values(AutomationErrorCategory).includes(value)
    ? value
    : AutomationErrorCategory.UNEXPECTED;
}

function categoryCode(category) {
  return `AUTOMATION_${String(category).toUpperCase()}_ERROR`;
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = ["field", "operation", "requestType", "workflow"];
  return Object.freeze(
    Object.fromEntries(
      allowed
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, normalizeText(value[key], 191)]),
    ),
  );
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

module.exports = {
  AutomationError,
  AutomationErrorCategory,
};
