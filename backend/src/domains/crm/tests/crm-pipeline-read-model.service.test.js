const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmPipelineService } = require("../application/crm-pipeline.service.js");
const {
  PIPELINE_STAGES,
  assertLeadStageTransition,
} = require("../domain/lead-stage-transition-policy.js");

test("pipeline policy preserves the canonical CRM stages and one transition source", () => {
  assert.deepEqual(PIPELINE_STAGES, [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
  ]);
  assert.equal(assertLeadStageTransition("NEW", "CONTACTED"), true);
  assert.throws(
    () => assertLeadStageTransition("NEW", "QUALIFIED"),
    (error) => error.code === "CRM_STAGE_TRANSITION_INVALID",
  );
  assert.throws(
    () => assertLeadStageTransition("WON", "LOST"),
    (error) => error.code === "CRM_STAGE_TERMINAL",
  );
});

test("pipeline service returns ordered metadata, possible states and configurable safe fields", () => {
  const service = new CrmPipelineService();
  const pipeline = service.getPipeline();
  assert.deepEqual(
    pipeline.stages.map(({ id, order }) => [id, order]),
    PIPELINE_STAGES.map((id, index) => [id, index + 1]),
  );
  assert.deepEqual(service.getPossibleStages("NEGOTIATION"), ["WON", "LOST"]);
  assert.deepEqual(service.validateTransition("CONTACTED", "QUALIFIED"), {
    currentStage: "CONTACTED",
    nextStage: "QUALIFIED",
    valid: true,
  });
  assert.deepEqual(
    pipeline.cardFields.map(({ key }) => key),
    ["leadId", "source", "assignedTo", "status", "updatedAt"],
  );
  assert.equal(JSON.stringify(pipeline).includes("contact"), false);
  assert.equal("repository" in service, false);
});
