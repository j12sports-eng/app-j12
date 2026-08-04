"use strict";

class ControlledBaselineError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ControlledBaselineError";
    this.code = code;
    this.details = details;
  }
}

function baselineError(message, code, details) {
  return new ControlledBaselineError(message, code, details);
}

module.exports = { ControlledBaselineError, baselineError };
