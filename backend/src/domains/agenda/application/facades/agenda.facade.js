const { AgendaApplicationService } = require("../services/agenda-application.service.js");

/**
 * Facade for the Agenda backend domain.
 *
 * Future modules should use this boundary instead of importing Agenda SQL,
 * legacy presence routes or Turmas routes directly.
 */
class AgendaFacade {
  /**
   * @param {Object} [options]
   * @param {AgendaApplicationService} [options.agendaService]
   * @param {AgendaApplicationService} [options.agendaApplicationService]
   * @param {import("../repositories/agenda.repository.js").AgendaRepository} [options.agendaRepository]
   * @param {Record<string, unknown>} [options.classFacade]
   * @param {Record<string, unknown>} [options.enrollmentFacade]
   * @param {Record<string, Function>|null} [options.notificationService]
   */
  constructor(options = {}) {
    const injectedService = options.agendaService || options.agendaApplicationService;

    this.agendaService =
      injectedService ||
      new AgendaApplicationService({
        agendaRepository: options.agendaRepository,
        classFacade: options.classFacade,
        enrollmentFacade: options.enrollmentFacade,
        notificationService: options.notificationService,
      });
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  findSchedulesByClass(input = {}) {
    return this.getAgendaService().findSchedulesByClass(input);
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  findSchedulesByStudent(input = {}) {
    return this.getAgendaService().findSchedulesByStudent(input);
  }

  /**
   * @param {{ enrollmentId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  findSchedulesByEnrollment(input = {}) {
    return this.getAgendaService().findSchedulesByEnrollment(input);
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  getAgendaSummaryByStudent(input = {}) {
    return this.getAgendaService().getAgendaSummaryByStudent(input);
  }

  /**
   * @param {{ enrollmentId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  getEnrollmentAgendaSummary(input = {}) {
    return this.getAgendaService().getEnrollmentAgendaSummary(input);
  }

  /**
   * @param {{ enrollmentId?: string|null, requestedBy?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  prepareInitialAgendaForEnrollment(input = {}) {
    return this.getAgendaService().prepareInitialAgendaForEnrollment(input);
  }

  /**
   * @param {{ enrollmentId?: string|null, requestedBy?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  createInitialAgendaForEnrollment(input = {}) {
    return this.getAgendaService().createInitialAgendaForEnrollment(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  validateAgendaEvent(input = {}) {
    return this.getAgendaService().validateAgendaEvent(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  rescheduleAgendaEvent(input = {}) {
    return this.getAgendaService().rescheduleAgendaEvent(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  previewRecurrence(input = {}) {
    return this.getAgendaService().previewRecurrence(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  createRecurrenceSeries(input = {}) {
    return this.getAgendaService().createRecurrenceSeries(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  getRecurrenceSeries(input = {}) {
    return this.getAgendaService().getRecurrenceSeries(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  updateRecurrence(input = {}) {
    return this.getAgendaService().updateRecurrence(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  cancelRecurrence(input = {}) {
    return this.getAgendaService().cancelRecurrence(input);
  }

  /**
   * @returns {AgendaApplicationService}
   */
  getAgendaService() {
    if (!this.agendaService || typeof this.agendaService !== "object") {
      throw new TypeError("AgendaFacade requires an agenda application service.");
    }

    return this.agendaService;
  }
}

module.exports = {
  AgendaFacade,
};
