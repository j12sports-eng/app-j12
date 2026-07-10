const {
  N8nIntegrationContract,
  validateCancellationReason,
  validateExecutionId,
} = require("../contracts/n8n-integration.contract.js");

const N8N_TRANSPORT_INVALID_CODE = "N8N_TRANSPORT_INVALID";

class N8nWorkflowAdapter extends N8nIntegrationContract {
  constructor(options = {}) {
    super();
    this.transport = options.transport || null;
  }

  async startWorkflow(input = {}) {
    const payload = this.validatePayload(input);
    return this.getTransportMethod("startWorkflow")({ payload });
  }

  async getExecutionStatus(input = {}) {
    const executionId = validateExecutionId(input.executionId);
    return this.getTransportMethod("getExecutionStatus")({ executionId });
  }

  async cancelExecution(input = {}) {
    const executionId = validateExecutionId(input.executionId);
    const reason = validateCancellationReason(input.reason);
    return this.getTransportMethod("cancelExecution")({ executionId, reason });
  }

  getTransportMethod(method) {
    const implementation = this.transport?.[method];
    if (typeof implementation !== "function") {
      const error = new TypeError(`N8n transport must implement ${method}.`);
      error.code = N8N_TRANSPORT_INVALID_CODE;
      error.details = { method };
      throw error;
    }
    return implementation.bind(this.transport);
  }
}

module.exports = {
  N8N_TRANSPORT_INVALID_CODE,
  N8nWorkflowAdapter,
};
