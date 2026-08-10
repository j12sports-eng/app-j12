"use strict";

class ControlledRetryFailedError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ControlledRetryFailedError";
    this.code = code;
    this.details = details;
  }
}

function retryFailedError(message, code, details) {
  return new ControlledRetryFailedError(message, code, details);
}

module.exports = { ControlledRetryFailedError, retryFailedError };
