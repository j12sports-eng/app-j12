const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CrmLeadStageTransitionController,
  readStageTransitionInput,
} = require("../controllers/crm-lead-stage-transition.controller.js");

test("stage controller allowlists body and never accepts client scope fields", () => {
  assert.throws(
    () =>
      readStageTransitionInput({
        params: { leadId: "lead-1" },
        body: { nextStage: "CONTACTED", unitId: "client" },
      }),
    (error) => error.code === "CRM_INPUT_INVALID",
  );
});

test("stage controller builds trusted context and response envelope", async () => {
  const calls = [];
  const controller = new CrmLeadStageTransitionController({
    leadUnitContextService: {
      async resolve(input) {
        calls.push(input);
        return { unitId: "unit-1", userId: "user-1" };
      },
    },
    leadService: {
      async moveLeadToStage(input, context) {
        return { leadId: input.leadId, stage: input.nextStage, status: "OPEN", context };
      },
    },
  });
  const response = {
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await controller.move(
    {
      params: { leadId: "lead-1" },
      body: { nextStage: "CONTACTED" },
      auth: { id: "user-1" },
      crmAuthorization: { granted: true },
      correlationId: "corr-1",
    },
    response,
    (error) => {
      throw error;
    },
  );
  assert.equal(response.code, 200);
  assert.equal(response.body.success, true);
  assert.equal(calls[0].leadId, "lead-1");
  assert.equal(calls[0].correlationId, "corr-1");
});
