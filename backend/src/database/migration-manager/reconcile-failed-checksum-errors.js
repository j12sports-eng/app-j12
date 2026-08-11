"use strict";

class ControlledChecksumReconciliationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ControlledChecksumReconciliationError";
    this.code = code;
    this.details = details;
  }
}

function checksumReconciliationError(message, code, details) {
  return new ControlledChecksumReconciliationError(message, code, details);
}

module.exports = { ControlledChecksumReconciliationError, checksumReconciliationError };
