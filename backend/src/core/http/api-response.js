const {
  createApiResponse,
  createErrorResponse,
  createSuccessResponse,
} = require("../../shared/api-response.js");

/**
 * Core HTTP response helpers for future controllers.
 *
 * These functions reexport the existing response helpers without changing any
 * current endpoint response. They are intentionally not imported by live routes.
 */
module.exports = {
  createApiResponse,
  createErrorResponse,
  createSuccessResponse,
};
