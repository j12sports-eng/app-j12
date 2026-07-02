const { BaseValidator } = require("../../validators/base.validator.js");

/**
 * Core export for the base validator contract.
 *
 * Reuses the existing BaseValidator so future validators can share a single
 * base contract without changing current services or controllers.
 */
module.exports = {
  BaseValidator,
};
