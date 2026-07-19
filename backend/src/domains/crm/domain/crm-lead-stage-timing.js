const HISTORY_COVERAGE = Object.freeze({
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  UNAVAILABLE: "UNAVAILABLE",
});

const KNOWN_STAGES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "TRIAL_SCHEDULED",
  "TRIAL_COMPLETED",
]);
const TERMINAL_STAGES = new Set(["WON", "LOST"]);

/**
 * Reconstructs only periods supported by persisted history. crm_leads.created_at
 * is deliberately not used as a synthetic initial stage event.
 */
function reconstructLeadStageTiming({ currentStage, history, now, truncated = false } = {}) {
  const measuredAt = utcIso(now);
  if (!measuredAt) throw new TypeError("A valid UTC clock instant is required.");

  const source = Array.isArray(history) ? history : [];
  const valid = source.map(normalizeEvent).filter(Boolean).sort(compareEvents);
  let partial = Boolean(truncated) || valid.length !== source.length;

  if (valid.length === 0) {
    return freezeResult({
      currentStageEntryAt: null,
      currentStageElapsedMs: null,
      historyCoverage: HISTORY_COVERAGE.UNAVAILABLE,
      measuredAt,
      stages: [],
      timeline: [],
    });
  }

  const first = valid[0];
  if (valid.some((event) => event.createdAt > measuredAt)) partial = true;
  const reliableInitialEvent =
    !truncated &&
    valid.length === source.length &&
    first.action === "CREATED" &&
    first.previousStage == null &&
    first.previousStatus == null;

  for (let index = 1; index < valid.length; index += 1) {
    const previous = valid[index - 1];
    const event = valid[index];
    if (event.previousStage !== previous.stage || event.previousStatus !== previous.newStatus) {
      partial = true;
    }
  }

  const timeline = valid.map((event, index) => {
    const next = valid[index + 1] || null;
    const isCurrent = !next && event.stage === currentStage;
    let exitAt = next?.createdAt || null;
    let durationMs = exitAt ? duration(event.createdAt, exitAt) : 0;

    if (isCurrent && !TERMINAL_STAGES.has(event.stage)) {
      exitAt = null;
      durationMs = duration(event.createdAt, measuredAt);
    }

    return Object.freeze({
      action: event.action,
      actorId: event.actorId,
      durationMs,
      entryAt: event.createdAt,
      exitAt,
      isCurrent,
      stage: event.stage,
    });
  });

  const current = timeline.at(-1)?.isCurrent ? timeline.at(-1) : null;
  if (!current) partial = true;
  const historyCoverage =
    reliableInitialEvent && !partial ? HISTORY_COVERAGE.COMPLETE : HISTORY_COVERAGE.PARTIAL;

  return freezeResult({
    currentStageEntryAt: current?.entryAt || null,
    currentStageElapsedMs: current?.durationMs ?? null,
    historyCoverage,
    measuredAt,
    stages: aggregateStages(timeline),
    timeline,
  });
}

function aggregateStages(timeline) {
  const aggregates = new Map();
  for (const period of timeline) {
    const current = aggregates.get(period.stage) || {
      firstEntryAt: period.entryAt,
      isCurrent: false,
      lastEntryAt: period.entryAt,
      lastExitAt: null,
      stage: period.stage,
      totalDurationMs: 0,
      visitCount: 0,
    };
    current.totalDurationMs += period.durationMs;
    current.visitCount += 1;
    current.lastEntryAt = period.entryAt;
    current.lastExitAt = period.exitAt;
    current.isCurrent = period.isCurrent;
    aggregates.set(period.stage, current);
  }
  return Array.from(aggregates.values(), (value) => Object.freeze({ ...value }));
}

function normalizeEvent(row) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "").trim();
  const stage = row.new_stage ?? row.newStage;
  const createdAt = utcIso(row.created_at ?? row.createdAt);
  const action = String(row.action || "")
    .trim()
    .slice(0, 32);
  const actorId = String(row.actor_id ?? row.actorId ?? "")
    .trim()
    .slice(0, 191);
  if (!id || !KNOWN_STAGES.has(stage) || !createdAt || !action || !actorId) return null;
  return Object.freeze({
    action,
    actorId,
    createdAt,
    id,
    newStatus: nullable(row.new_status ?? row.newStatus),
    previousStage: nullable(row.previous_stage ?? row.previousStage),
    previousStatus: nullable(row.previous_status ?? row.previousStatus),
    stage,
  });
}

function utcIso(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;
  const source = value.trim();
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(source);
  const candidate = explicit ? source : `${source.replace(" ", "T")}Z`;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function compareEvents(left, right) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function duration(entryAt, exitAt) {
  return Math.max(0, Date.parse(exitAt) - Date.parse(entryAt));
}

function nullable(value) {
  return value == null || value === "" ? null : String(value);
}

function freezeResult(result) {
  return Object.freeze({
    ...result,
    stages: Object.freeze(result.stages),
    timeline: Object.freeze(result.timeline),
  });
}

module.exports = {
  HISTORY_COVERAGE,
  KNOWN_STAGES,
  TERMINAL_STAGES,
  aggregateStages,
  reconstructLeadStageTiming,
  utcIso,
};
