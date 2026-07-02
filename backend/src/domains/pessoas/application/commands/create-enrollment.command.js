/**
 * Input command for the Create Enrollment application flow.
 *
 * This command only wraps the received payload and exposes read helpers for the
 * current first step. It does not validate, persist, call repositories or emit
 * domain events.
 */
class CreateEnrollmentCommand {
  /**
   * @param {unknown} [payload]
   */
  constructor(payload = {}) {
    this.payload = payload && typeof payload === "object" ? payload : {};
  }

  /**
   * Returns the original payload shape expected by the current request DTO.
   *
   * @returns {unknown}
   */
  getPayload() {
    return this.payload;
  }

  /**
   * Returns the first responsible person payload, when present.
   *
   * @returns {Record<string, unknown>}
   */
  getFirstResponsible() {
    const responsaveis = this.payload?.responsaveis;
    const firstResponsible = Array.isArray(responsaveis) ? responsaveis[0] : null;

    return firstResponsible && typeof firstResponsible === "object" && !Array.isArray(firstResponsible)
      ? firstResponsible
      : {};
  }

  /**
   * @returns {boolean}
   */
  hasResponsible() {
    return Object.keys(this.getFirstResponsible()).length > 0;
  }
}

module.exports = {
  CreateEnrollmentCommand,
};
