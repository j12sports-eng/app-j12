const METRIC_NAMES = Object.freeze({
  ATTEMPTS: "crm_lead_enrollment_conversion_attempts_total",
  SUCCESS: "crm_lead_enrollment_conversion_success_total",
  FAILURE: "crm_lead_enrollment_conversion_failure_total",
  DURATION: "crm_lead_enrollment_conversion_duration_ms",
  REUSED: "crm_lead_enrollment_conversion_reused_total",
  STAGE_ATTEMPTS: "crm_lead_stage_transition_attempts_total",
  STAGE_SUCCESS: "crm_lead_stage_transition_success_total",
  STAGE_FAILURE: "crm_lead_stage_transition_failure_total",
  STAGE_DURATION: "crm_lead_stage_transition_duration_ms",
});

const ALLOWED_LABELS = new Set([
  "result",
  "errorCode",
  "enrollmentResolution",
  "source",
  "fromStage",
  "toStage",
  "errorCategory",
]);
const MAX_SERIES = 32;

/**
 * Small process-local collector. It intentionally exposes no HTTP endpoint and
 * keeps only bounded, low-cardinality series until a metrics adapter exists.
 */
class CrmLeadEnrollmentConversionMetrics {
  constructor({ maxSeries = MAX_SERIES } = {}) {
    this.maxSeries = Number.isInteger(maxSeries) && maxSeries > 0 ? maxSeries : MAX_SERIES;
    this.counters = new Map();
    this.observations = new Map();
  }

  increment(name, labels = {}) {
    const key = this.seriesKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
    return this.counters.get(key);
  }

  observe(name, value, labels = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    const key = this.seriesKey(name, labels);
    const previous = this.observations.get(key) || { count: 0, sum: 0, max: 0 };
    const next = {
      count: previous.count + 1,
      sum: previous.sum + Math.trunc(parsed),
      max: Math.max(previous.max, Math.trunc(parsed)),
    };
    this.observations.set(key, next);
    return Object.freeze({ ...next });
  }

  snapshot() {
    return Object.freeze({
      counters: Object.freeze(Object.fromEntries(this.counters)),
      observations: Object.freeze(
        Object.fromEntries(
          [...this.observations.entries()].map(([key, value]) => [
            key,
            Object.freeze({ ...value }),
          ]),
        ),
      ),
    });
  }

  seriesKey(name, labels) {
    const metric = safeMetricName(name);
    const safeLabels = normalizeLabels(labels);
    const key = `${metric}|${JSON.stringify(safeLabels)}`;
    if (!this.counters.has(key) && !this.observations.has(key)) {
      const seriesCount = new Set([...this.counters.keys(), ...this.observations.keys()]).size;
      if (seriesCount >= this.maxSeries) return `${metric}|{}`;
    }
    return key;
  }
}

function normalizeLabels(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => ALLOWED_LABELS.has(key))
      .map(([key, value]) => [key, normalizeLabel(value)])
      .filter(([, value]) => value),
  );
}

function normalizeLabel(value) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 64) : null;
}

function safeMetricName(value) {
  const text = String(value || "").trim();
  return /^[a-z][a-z0-9_]{1,127}$/.test(text)
    ? text
    : "crm_lead_enrollment_conversion_unknown_total";
}

module.exports = {
  ALLOWED_LABELS,
  CrmLeadEnrollmentConversionMetrics,
  METRIC_NAMES,
  normalizeLabels,
};
