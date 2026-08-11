"use strict";

class ControlledMaterializedFinalizeError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ControlledMaterializedFinalizeError";
    this.code = code;
    this.details = details;
  }
}

function materializedFinalizeError(message, code, details) {
  return new ControlledMaterializedFinalizeError(message, code, details);
}

module.exports = { ControlledMaterializedFinalizeError, materializedFinalizeError };
