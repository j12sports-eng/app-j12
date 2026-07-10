const N8N_INTEGRATION_NOT_IMPLEMENTED_CODE = "N8N_INTEGRATION_NOT_IMPLEMENTED";
const N8N_INTEGRATION_PAYLOAD_INVALID_CODE = "N8N_INTEGRATION_PAYLOAD_INVALID";

class N8nIntegrationContract {
  async startWorkflow() {
    throw contractError("startWorkflow");
  }

  async getExecutionStatus() {
    throw contractError("getExecutionStatus");
  }

  async cancelExecution() {
    throw contractError("cancelExecution");
  }

  validatePayload(input = {}) {
    return validateN8nPayload(input);
  }
}

function validateN8nPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw payloadError("N8n payload must be a plain object.", { field: "payload" });
  }

  const workflowKey = requiredText(input.workflowKey, "workflowKey", 120);
  const correlationId = requiredText(input.correlationId, "correlationId", 191);
  const data = input.data === undefined ? {} : input.data;
  const metadata = input.metadata === undefined ? {} : input.metadata;

  if (!isPlainObject(data)) {
    throw payloadError("N8n payload data must be a plain object.", { field: "data" });
  }

  if (!isPlainObject(metadata)) {
    throw payloadError("N8n payload metadata must be a plain object.", { field: "metadata" });
  }

  assertJsonSafe(data, "data");
  assertJsonSafe(metadata, "metadata");

  return Object.freeze({
    correlationId,
    data: cloneJson(data),
    metadata: cloneJson(metadata),
    workflowKey,
  });
}

function validateExecutionId(value) {
  return requiredText(value, "executionId", 191);
}

function validateCancellationReason(value) {
  return requiredText(value, "reason", 500);
}

function assertJsonSafe(value, path, seen = new Set(), depth = 0) {
  if (depth > 12) {
    throw payloadError("N8n payload exceeds the supported nesting depth.", { field: path });
  }

  if (value === null || ["string", "boolean"].includes(typeof value)) return;

  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw payloadError("N8n payload numbers must be finite.", { field: path });
  }

  if (typeof value !== "object") {
    throw payloadError("N8n payload contains a non-JSON value.", { field: path });
  }

  if (seen.has(value)) {
    throw payloadError("N8n payload cannot contain circular references.", { field: path });
  }

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw payloadError("N8n payload contains an unsupported object.", { field: path });
  }

  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    assertJsonSafe(item, `${path}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function requiredText(value, field, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw payloadError(`N8n integration requires a valid ${field}.`, { field });
  }
  return normalized;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function contractError(method) {
  const error = new TypeError(`N8nIntegrationContract implementation must provide ${method}.`);
  error.code = N8N_INTEGRATION_NOT_IMPLEMENTED_CODE;
  error.details = { method };
  return error;
}

function payloadError(message, details) {
  const error = new TypeError(message);
  error.code = N8N_INTEGRATION_PAYLOAD_INVALID_CODE;
  error.details = details;
  return error;
}

module.exports = {
  N8N_INTEGRATION_NOT_IMPLEMENTED_CODE,
  N8N_INTEGRATION_PAYLOAD_INVALID_CODE,
  N8nIntegrationContract,
  validateCancellationReason,
  validateExecutionId,
  validateN8nPayload,
};
