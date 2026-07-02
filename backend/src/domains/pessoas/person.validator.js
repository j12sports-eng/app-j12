/**
 * Future validator boundary for Person DTOs.
 *
 * No validation rules are implemented in Sprint 7.0 to avoid changing current
 * behavior or defining contracts before the migration plan is approved.
 */
class PersonValidator {
  /**
   * @param {unknown} payload
   * @returns {{ payload: unknown, valid: boolean, errors: Array<unknown> }}
   */
  validate(payload) {
    return {
      errors: [],
      payload,
      valid: true,
    };
  }
}

module.exports = {
  PersonValidator,
};
