/**
 * DTO returned by CreateEnrollmentUseCase.
 *
 * It represents only an execution plan. It never represents persisted data and
 * does not imply that any operation was executed.
 */
class CreateEnrollmentResponse {
  /**
   * @param {Object} input
   * @param {boolean} input.valid
   * @param {boolean} input.executable
   * @param {string[]} input.steps
   * @param {Array<{ field: string, message: string, code: string }>} input.errors
   * @param {Array<{ field: string, message: string, code: string }>} [input.warnings]
   * @param {Record<string, unknown>} [input.requiredProfiles]
   * @param {Record<string, unknown>} [input.metadata]
   */
  constructor({
    errors = [],
    executable = false,
    metadata = {},
    requiredProfiles = {},
    steps = [],
    valid = false,
    warnings = [],
  } = {}) {
    this.valid = Boolean(valid);
    this.executable = Boolean(executable);
    this.steps = Array.isArray(steps) ? [...steps] : [];
    this.errors = Array.isArray(errors) ? [...errors] : [];
    this.warnings = Array.isArray(warnings) ? [...warnings] : [];
    this.requiredProfiles = requiredProfiles && typeof requiredProfiles === "object"
      ? { ...requiredProfiles }
      : {};
    this.metadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      errors: this.errors,
      executable: this.executable,
      metadata: this.metadata,
      requiredProfiles: this.requiredProfiles,
      steps: this.steps,
      valid: this.valid,
      warnings: this.warnings,
    };
  }
}

module.exports = {
  CreateEnrollmentResponse,
};
