const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const test = require("node:test");
const {
  CrmLeadStageTimingController,
} = require("../controllers/crm-lead-stage-timing.controller.js");

test("timing controller is thin, validates input and returns the standard envelope", async () => {
  let received;
  const controller = new CrmLeadStageTimingController({
    queryService: {
      async getLeadStageTiming(input) {
        received = input;
        return { leadId: input.leadId };
      },
    },
  });
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  await controller.getByLeadId(
    { params: { leadId: "lead-1" }, query: { unitId: "unit-1" } },
    response,
    (error) => {
      throw error;
    },
  );
  assert.deepEqual(received, { leadId: "lead-1", unitId: "unit-1" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { success: true, data: { leadId: "lead-1" } });
});

test("timing controller imports no repository and forwards deterministic errors", async () => {
  const source = await readFile(
    require.resolve("../controllers/crm-lead-stage-timing.controller.js"),
    "utf8",
  );
  assert.equal(/repository/i.test(source), false);

  const controller = new CrmLeadStageTimingController({
    queryService: { async getLeadStageTiming() {} },
  });
  let forwarded;
  await controller.getByLeadId({ params: { leadId: "bad id" }, query: {} }, {}, (error) => {
    forwarded = error;
  });
  assert.equal(forwarded.code, "CRM_INPUT_INVALID");
  assert.equal(forwarded.statusCode, 400);
});
