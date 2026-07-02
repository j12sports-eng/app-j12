const { HttpStatus } = require("../../constants/http-status.js");

/**
 * Shared HTTP status constants for future controllers and middlewares.
 *
 * Reexports the existing constants to keep one status-code contract.
 */
module.exports = {
  HttpStatus,
};
