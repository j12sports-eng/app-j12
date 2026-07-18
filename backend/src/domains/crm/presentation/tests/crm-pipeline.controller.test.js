const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmPipelineController } = require("../controllers/crm-pipeline.controller.js");

function response() {
  return {
    body: null,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("pipeline controller delegates one read-only response", async () => {
  let calls = 0;
  const controller = new CrmPipelineController({
    pipelineService: {
      getPipeline() {
        calls += 1;
        return { stages: [] };
      },
    },
  });
  const res = response();
  await controller.get({ query: {} }, res, assert.fail);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { stages: [] } });
  assert.equal(calls, 1);
});

test("pipeline controller rejects query parameters before service execution", async () => {
  const controller = new CrmPipelineController({
    pipelineService: { getPipeline: assert.fail },
  });
  let received;
  await controller.get({ query: { unitId: "unit-1" } }, response(), (error) => {
    received = error;
  });
  assert.equal(received.code, "CRM_INPUT_INVALID");
  assert.equal(received.statusCode, 400);
});
