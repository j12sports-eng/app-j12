/**
 * @typedef {Object} ValidationIssue
 * @property {string} field
 * @property {string} message
 * @property {string|null} [code]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Array<ValidationIssue>} errors
 */

/**
 * Creates a successful validation result for future validators.
 *
 * @returns {ValidationResult}
 */
function createValidResult() {
  return {
    errors: [],
    valid: true,
  };
}

/**
 * Creates a failed validation result for future validators.
 *
 * @param {Array<ValidationIssue>} errors
 * @returns {ValidationResult}
 */
function createInvalidResult(errors) {
  return {
    errors: Array.isArray(errors) ? errors : [],
    valid: false,
  };
}

module.exports = {
  createInvalidResult,
  createValidResult,
};
