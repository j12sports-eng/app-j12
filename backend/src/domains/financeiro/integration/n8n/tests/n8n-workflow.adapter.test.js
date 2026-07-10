const assert = require("node:assert/strict");
const test = require("node:test");

const {
  N8N_TRANSPORT_INVALID_CODE,
  N8nWorkflowAdapter,
} = require("../adapters/n8n-workflow.adapter.js");

test("N8nWorkflowAdapter delegates start, status and cancellation to the injected transport", async () => {
  const calls = [];
  const transport = {
    async cancelExecution(input) {
      calls.push(["cancel", input]);
      return { executionId: input.executionId, status: "CANCELLED" };
    },
    async getExecutionStatus(input) {
      calls.push(["status", input]);
      return { executionId: input.executionId, status: "RUNNING" };
    },
    async startWorkflow(input) {
      calls.push(["start", input]);
      return { executionId: "exec-mock-1", status: "STARTED" };
    },
  };
  const adapter = new N8nWorkflowAdapter({ transport });

  const started = await adapter.startWorkflow({
    correlationId: "corr-1",
    data: { synthetic: true },
    workflowKey: "financeiro-lembretes",
  });
  const status = await adapter.getExecutionStatus({ executionId: started.executionId });
  const cancelled = await adapter.cancelExecution({
    executionId: started.executionId,
    reason: "controlled mock cancellation",
  });

  assert.equal(started.status, "STARTED");
  assert.equal(status.status, "RUNNING");
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(calls.length, 3);
  assert.equal(calls[0][1].payload.data.synthetic, true);
});

test("N8nWorkflowAdapter validates before invoking the transport", async () => {
  let called = false;
  const adapter = new N8nWorkflowAdapter({
    transport: {
      async startWorkflow() {
        called = true;
      },
    },
  });

  await assert.rejects(adapter.startWorkflow({ workflowKey: "workflow" }));
  assert.equal(called, false);
});

test("N8nWorkflowAdapter fails closed when a transport method is absent", async () => {
  const adapter = new N8nWorkflowAdapter({ transport: {} });

  await assert.rejects(adapter.getExecutionStatus({ executionId: "exec-mock" }), {
    code: N8N_TRANSPORT_INVALID_CODE,
  });
});
