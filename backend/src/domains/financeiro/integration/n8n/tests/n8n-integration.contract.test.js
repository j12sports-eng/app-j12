const assert = require("node:assert/strict");
const test = require("node:test");

const {
  N8N_INTEGRATION_NOT_IMPLEMENTED_CODE,
  N8N_INTEGRATION_PAYLOAD_INVALID_CODE,
  N8nIntegrationContract,
  validateN8nPayload,
} = require("../contracts/n8n-integration.contract.js");

test("N8nIntegrationContract keeps transport operations abstract", async () => {
  const contract = new N8nIntegrationContract();

  await assert.rejects(contract.startWorkflow(), {
    code: N8N_INTEGRATION_NOT_IMPLEMENTED_CODE,
  });
  await assert.rejects(contract.getExecutionStatus(), {
    code: N8N_INTEGRATION_NOT_IMPLEMENTED_CODE,
  });
  await assert.rejects(contract.cancelExecution(), {
    code: N8N_INTEGRATION_NOT_IMPLEMENTED_CODE,
  });
});

test("validateN8nPayload normalizes and clones a JSON-safe payload", () => {
  const input = {
    correlationId: " corr-20-8 ",
    data: { item: { id: "synthetic-1" } },
    metadata: { mode: "MOCK" },
    workflowKey: " financeiro-lembretes ",
  };

  const result = validateN8nPayload(input);
  input.data.item.id = "changed";

  assert.equal(result.correlationId, "corr-20-8");
  assert.equal(result.workflowKey, "financeiro-lembretes");
  assert.equal(result.data.item.id, "synthetic-1");
  assert.equal(Object.isFrozen(result), true);
});

test("validateN8nPayload rejects missing identifiers and non-JSON values", () => {
  assert.throws(() => validateN8nPayload({}), {
    code: N8N_INTEGRATION_PAYLOAD_INVALID_CODE,
  });
  assert.throws(
    () =>
      validateN8nPayload({
        correlationId: "corr-1",
        data: { callback: () => {} },
        workflowKey: "workflow-1",
      }),
    { code: N8N_INTEGRATION_PAYLOAD_INVALID_CODE },
  );
});
