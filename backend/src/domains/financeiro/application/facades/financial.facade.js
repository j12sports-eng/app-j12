const { FinancialApplicationService } = require("../services/financial-application.service.js");

/**
 * Facade for internal Financeiro application operations.
 *
 * It exposes Enrollment billing contracts and internal financial obligation
 * operations through application services. Existing public financial routes
 * remain unchanged.
 */
class FinancialFacade {
  /**
   * @param {Object} [options]
   * @param {FinancialApplicationService} [options.financialService]
   * @param {FinancialApplicationService} [options.financialApplicationService]
   * @param {Record<string, unknown>} [options.enrollmentReader]
   * @param {Function|Record<string, Function>|null} [options.billingSourceReader]
   * @param {Record<string, Function>|null} [options.financialObligationRepository]
   */
  constructor(options = {}) {
    this.financialService =
      options.financialService ||
      options.financialApplicationService ||
      new FinancialApplicationService({
        billingSourceReader: options.billingSourceReader || null,
        enrollmentReader: options.enrollmentReader || null,
        financialObligationRepository: options.financialObligationRepository || null,
      });
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareEnrollmentBillingContract(input = {}) {
    return this.getFinancialService().prepareEnrollmentBillingContract(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  createInitialEnrollmentFinancialObligation(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.createInitialEnrollmentFinancialObligation !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.createInitialEnrollmentFinancialObligation function.",
      );
    }

    return service.createInitialEnrollmentFinancialObligation(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  findEnrollmentFinancialObligation(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.findEnrollmentFinancialObligation !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.findEnrollmentFinancialObligation function.",
      );
    }

    return service.findEnrollmentFinancialObligation(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  createEnrollmentFinancialObligationRecord(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.createEnrollmentFinancialObligationRecord !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.createEnrollmentFinancialObligationRecord function.",
      );
    }

    return service.createEnrollmentFinancialObligationRecord(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  listEnrollmentFinancialObligations(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.listEnrollmentFinancialObligations !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.listEnrollmentFinancialObligations function.",
      );
    }

    return service.listEnrollmentFinancialObligations(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  getStudentFinancialSummary(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.getStudentFinancialSummary !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.getStudentFinancialSummary function.",
      );
    }

    return service.getStudentFinancialSummary(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  markEnrollmentFinancialObligationAsPaid(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.markEnrollmentFinancialObligationAsPaid !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.markEnrollmentFinancialObligationAsPaid function.",
      );
    }

    return service.markEnrollmentFinancialObligationAsPaid(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  cancelEnrollmentFinancialObligation(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.cancelEnrollmentFinancialObligation !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.cancelEnrollmentFinancialObligation function.",
      );
    }

    return service.cancelEnrollmentFinancialObligation(input);
  }

  /**
   * @param {Object} input
   * @returns {Promise<Record<string, unknown>>}
   */
  markEnrollmentFinancialObligationAsOverdue(input = {}) {
    const service = this.getFinancialService();

    if (typeof service.markEnrollmentFinancialObligationAsOverdue !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.markEnrollmentFinancialObligationAsOverdue function.",
      );
    }

    return service.markEnrollmentFinancialObligationAsOverdue(input);
  }

  /**
   * @returns {{ prepareEnrollmentBillingContract: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }}
   */
  getFinancialService() {
    if (typeof this.financialService?.prepareEnrollmentBillingContract !== "function") {
      throw new TypeError(
        "FinancialFacade requires a financialService.prepareEnrollmentBillingContract function.",
      );
    }

    return this.financialService;
  }
}

module.exports = {
  FinancialFacade,
};
