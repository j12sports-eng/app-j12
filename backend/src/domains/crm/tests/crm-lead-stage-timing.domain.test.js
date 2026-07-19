const assert = require("node:assert/strict");
const test = require("node:test");
const { reconstructLeadStageTiming, utcIso } = require("../domain/crm-lead-stage-timing.js");

const NOW = "2026-07-18T12:00:00.000Z";

function event(id, stage, createdAt, overrides = {}) {
  return {
    action: id === "a" ? "CREATED" : "STAGE_CHANGED",
    actor_id: "operator-1",
    created_at: createdAt,
    id,
    new_stage: stage,
    new_status: stage === "WON" ? "CONVERTED" : "OPEN",
    previous_stage: id === "a" ? null : "NEW",
    previous_status: id === "a" ? null : "OPEN",
    ...overrides,
  };
}

test("no history is unavailable and never invents lead createdAt", () => {
  const result = reconstructLeadStageTiming({ currentStage: "NEW", history: [], now: NOW });
  assert.equal(result.historyCoverage, "UNAVAILABLE");
  assert.equal(result.currentStageEntryAt, null);
  assert.equal(result.currentStageElapsedMs, null);
  assert.deepEqual(result.timeline, []);
});

test("reliable initial event and fixed clock produce complete UTC timing", () => {
  const result = reconstructLeadStageTiming({
    currentStage: "NEW",
    history: [event("a", "NEW", "2026-07-18 10:00:00")],
    now: NOW,
  });
  assert.equal(result.historyCoverage, "COMPLETE");
  assert.equal(result.currentStageEntryAt, "2026-07-18T10:00:00.000Z");
  assert.equal(result.currentStageElapsedMs, 7_200_000);
  assert.equal(result.measuredAt, NOW);
  assert.equal(utcIso("2026-07-18 10:00:00"), "2026-07-18T10:00:00.000Z");
});

test("multiple transitions aggregate visits, totals and current stage", () => {
  const result = reconstructLeadStageTiming({
    currentStage: "CONTACTED",
    now: NOW,
    history: [
      event("a", "NEW", "2026-07-18T08:00:00Z"),
      event("b", "CONTACTED", "2026-07-18T09:00:00Z"),
      event("c", "NEW", "2026-07-18T10:00:00Z", { previous_stage: "CONTACTED" }),
      event("d", "CONTACTED", "2026-07-18T11:00:00Z"),
    ],
  });
  assert.equal(result.timeline.length, 4);
  const contacted = result.stages.find((stage) => stage.stage === "CONTACTED");
  assert.equal(contacted.visitCount, 2);
  assert.equal(contacted.totalDurationMs, 7_200_000);
  assert.equal(contacted.firstEntryAt, "2026-07-18T09:00:00.000Z");
  assert.equal(contacted.lastEntryAt, "2026-07-18T11:00:00.000Z");
  assert.equal(contacted.lastExitAt, null);
  assert.equal(contacted.isCurrent, true);
});

test("same timestamps use id tie-break and durations never become negative", () => {
  const result = reconstructLeadStageTiming({
    currentStage: "QUALIFIED",
    now: "2026-07-18T09:00:00Z",
    history: [
      event("c", "QUALIFIED", "2026-07-18T10:00:00Z", { previous_stage: "CONTACTED" }),
      event("b", "CONTACTED", "2026-07-18T10:00:00Z"),
      event("a", "NEW", "2026-07-18T10:00:00Z"),
    ],
  });
  assert.deepEqual(
    result.timeline.map((period) => period.stage),
    ["NEW", "CONTACTED", "QUALIFIED"],
  );
  assert.equal(
    result.timeline.every((period) => period.durationMs >= 0),
    true,
  );
  assert.equal(result.currentStageElapsedMs, 0);
});

test("partial, invalid and truncated histories remain explicit", () => {
  const partial = reconstructLeadStageTiming({
    currentStage: "CONTACTED",
    now: NOW,
    history: [event("b", "CONTACTED", "2026-07-18T11:00:00Z")],
  });
  assert.equal(partial.historyCoverage, "PARTIAL");
  assert.equal(partial.currentStageElapsedMs, 3_600_000);

  const invalid = reconstructLeadStageTiming({
    currentStage: "CONTACTED",
    now: NOW,
    history: [event("a", "NEW", "2026-07-18T10:00:00Z"), { id: "bad" }],
  });
  assert.equal(invalid.historyCoverage, "PARTIAL");

  const truncated = reconstructLeadStageTiming({
    currentStage: "NEW",
    now: NOW,
    history: [event("a", "NEW", "2026-07-18T10:00:00Z")],
    truncated: true,
  });
  assert.equal(truncated.historyCoverage, "PARTIAL");
});

test("terminal current stage is completed at entry and does not keep counting", () => {
  const result = reconstructLeadStageTiming({
    currentStage: "WON",
    now: NOW,
    history: [event("a", "NEW", "2026-07-18T08:00:00Z"), event("b", "WON", "2026-07-18T10:00:00Z")],
  });
  assert.equal(result.currentStageElapsedMs, 0);
  assert.equal(result.timeline[0].durationMs, 7_200_000);
  assert.equal(result.timeline[1].durationMs, 0);
});
