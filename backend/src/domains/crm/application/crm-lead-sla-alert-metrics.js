const METRIC_NAMES = Object.freeze({
  ATTEMPTS: "crm_sla_alert_query_attempts_total",
  DURATION: "crm_sla_alert_query_duration_ms",
  FAILURE: "crm_sla_alert_query_failure_total",
  ITEMS: "crm_sla_alert_items_total",
  SUCCESS: "crm_sla_alert_query_success_total",
});

const ALLOWED_METRIC_NAMES = new Set(Object.values(METRIC_NAMES));
const ALLOWED_LABELS = new Set(["alertStatus", "result", "source", "stage"]);
const MAX_SERIES = 128;

/** Bounded process-local metrics until a shared exporter is available. */
class CrmLeadSlaAlertMetrics {
  constructor({ maxSeries = MAX_SERIES } = {}) {
    this.maxSeries = Number.isSafeInteger(maxSeries) && maxSeries > 0 ? maxSeries : MAX_SERIES;
    this.counters = new Map();
    this.observations = new Map();
  }

  increment(name, labels = {}, amount = 1) {
    const parsed = Number(amount);
    if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
    const key = this.seriesKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + parsed);
    return this.counters.get(key);
  }

  observe(name, value, labels = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    const key = this.seriesKey(name, labels);
    const previous = this.observations.get(key) || { count: 0, max: 0, sum: 0 };
    const measured = Math.trunc(parsed);
    const next = {
      count: previous.count + 1,
      max: Math.max(previous.max, measured),
      sum: previous.sum + measured,
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
    const metric = ALLOWED_METRIC_NAMES.has(name) ? name : "crm_sla_alert_unknown_total";
    const normalizedLabels = normalizeLabels(labels);
    const key = `${metric}|${JSON.stringify(normalizedLabels)}`;
    if (!this.counters.has(key) && !this.observations.has(key)) {
      const count = new Set([...this.counters.keys(), ...this.observations.keys()]).size;
      if (count >= this.maxSeries) return `${metric}|{}`;
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
      .filter(([, value]) => value != null),
  );
}

function normalizeLabel(value) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 64) : null;
}

module.exports = {
  ALLOWED_LABELS,
  CrmLeadSlaAlertMetrics,
  MAX_SERIES,
  METRIC_NAMES,
  normalizeLabels,
};
