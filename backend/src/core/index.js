/**
 * Central Core export for future backend modules.
 *
 * This file only exposes infrastructure primitives. It is not imported by the
 * current runtime, so existing routes, controllers and services keep their
 * behavior unchanged.
 */
module.exports = {
  ...require("./database/database-context.js"),
  ...require("./errors/app-error.js"),
  ...require("./errors/http-errors.js"),
  ...require("./http/api-response.js"),
  ...require("./http/http-status.js"),
  ...require("./logger/logger.js"),
  ...require("./shared/pagination.js"),
  ...require("./shared/shared-constants.js"),
  ...require("./validation/base-validator.js"),
  ...require("./validation/validation-result.js"),
};
