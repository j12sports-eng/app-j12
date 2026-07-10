const ALLOWED_MODES = Object.freeze(["dry_run", "hml"]);

class ScenarioDefinition {
  constructor(input = {}) {
    this.id = requiredText(input.id, "id", 120);
    this.name = requiredText(input.name, "name", 160);
    this.description = requiredText(input.description, "description", 500);
    this.workflow = requiredText(input.workflow, "workflow", 120);
    this.payload = Object.freeze(cloneObject(input.payload, "payload"));
    this.expectedResult = Object.freeze(cloneObject(input.expectedResult, "expectedResult"));
    this.mode = normalizeMode(input.mode);
    Object.freeze(this);
  }

  toJSON() {
    return {
      description: this.description,
      expectedResult: this.expectedResult,
      id: this.id,
      mode: this.mode,
      name: this.name,
      payload: this.payload,
      workflow: this.workflow,
    };
  }

  static from(value) {
    return value instanceof ScenarioDefinition ? value : new ScenarioDefinition(value);
  }
}

function normalizeMode(value) {
  const mode = String(value || "dry_run").trim().toLowerCase();
  if (!ALLOWED_MODES.includes(mode)) {
    throw new TypeError(`Scenario mode must be one of: ${ALLOWED_MODES.join(", ")}.`);
  }
  return mode;
}

function requiredText(value, field, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new TypeError(`Scenario requires a valid ${field}.`);
  }
  return normalized;
}

function cloneObject(value, field) {
  const source = value === undefined ? {} : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError(`Scenario requires ${field} as an object.`);
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch {
    throw new TypeError(`Scenario requires JSON-safe ${field}.`);
  }
}

module.exports = { ALLOWED_SCENARIO_MODES: ALLOWED_MODES, ScenarioDefinition };
