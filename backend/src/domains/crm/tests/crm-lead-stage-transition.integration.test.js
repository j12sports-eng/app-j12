const test = require("node:test");
const assert = require("node:assert/strict");
const { CrmLeadService } = require("../application/crm-lead.service.js");
const {
  CrmLeadStageTransitionController,
} = require("../presentation/controllers/crm-lead-stage-transition.controller.js");
const {
  CrmLeadStageTransitionObservabilityDecorator,
} = require("../application/crm-lead-stage-transition-observability.decorator.js");

function harness(record = {}) {
  const events = [];
  const repository = {
    async findById() {
      return {
        id: "lead-1",
        unit_id: "unit-1",
        stage: "NEW",
        status: "OPEN",
        source: "site",
        contact_name: "Contato teste",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...record,
      };
    },
    async saveStageTransition({ next }) {
      return { id: next.id, stage: next.stage, status: next.status, updatedAt: next.updatedAt };
    },
  };
  const service = new CrmLeadService({ repository, now: () => new Date("2026-07-18T12:00:00Z") });
  const observed = new CrmLeadStageTransitionObservabilityDecorator({
    stageTransitionService: service,
    auditService: {
      async recordStageStart(v) {
        events.push(["start", v]);
      },
      async recordStageSuccess(v) {
        events.push(["success", v]);
      },
      async recordStageFailure(v) {
        events.push(["failure", v]);
      },
    },
    now: () => 1,
  });
  const controller = new CrmLeadStageTransitionController({
    leadService: observed,
    leadUnitContextService: {
      async resolve() {
        return { unitId: "unit-1", userId: "user-1", authorization: { granted: true } };
      },
    },
  });
  return { controller, events };
}

test("controller real + service real moves stage without exposing PII", async () => {
  const { controller, events } = harness();
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await controller.move(
    {
      params: { leadId: "lead-1" },
      body: { nextStage: "CONTACTED", expectedStage: "NEW", expectedStatus: "OPEN" },
      auth: { id: "user-1" },
      correlationId: "corr-1",
    },
    response,
    (error) => {
      throw error;
    },
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    Object.keys(response.body.data).sort(),
    [
      "id",
      "leadId",
      "nextStage",
      "nextStatus",
      "previousStage",
      "previousStatus",
      "stage",
      "status",
      "unitId",
      "updatedAt",
    ].sort(),
  );
  assert.equal(events[0][0], "start");
  assert.equal(events[1][0], "success");
  assert.equal(events[0][1].reason, undefined);
});

test("LOST requires a bounded reason and records failure safely", async () => {
  const { controller, events } = harness();
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let failure;
  await controller.move(
    {
      params: { leadId: "lead-1" },
      body: { nextStage: "LOST" },
      auth: { id: "user-1" },
      correlationId: "corr-1",
    },
    response,
    (error) => {
      failure = error;
    },
  );
  assert.equal(failure.code, "CRM_LOST_REASON_REQUIRED");
  assert.equal(events.at(-1)[0], "failure");
  assert.equal(events.at(-1)[1].reason, undefined);
});
