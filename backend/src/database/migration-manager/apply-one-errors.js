"use strict";

class ControlledApplyOneError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ControlledApplyOneError";
    this.code = code;
    this.details = details;
  }
}

function applyOneError(message, code, details) {
  return new ControlledApplyOneError(message, code, details);
}

module.exports = { ControlledApplyOneError, applyOneError };
