const {
  ClassApplicationService,
} = require("../services/class-application.service.js");

/**
 * Facade for the Classes/Turmas backend domain.
 *
 * Future modules should depend on this boundary instead of importing legacy
 * Turmas routes or SQL directly.
 */
class ClassFacade {
  /**
   * @param {Object} [options]
   * @param {ClassApplicationService} [options.classService]
   * @param {ClassApplicationService} [options.classApplicationService]
   * @param {import("../repositories/class.repository.js").ClassRepository} [options.classRepository]
   */
  constructor(options = {}) {
    const injectedService = options.classService || options.classApplicationService;

    this.classService =
      injectedService ||
      new ClassApplicationService({
        classRepository: options.classRepository,
      });
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  findClassById(input = {}) {
    return this.getClassService().findClassById(input);
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  findActiveClassById(input = {}) {
    return this.getClassService().findActiveClassById(input);
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  getClassCapacitySummary(input = {}) {
    return this.getClassService().getClassCapacitySummary(input);
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  ensureClassHasAvailableCapacity(input = {}) {
    return this.getClassService().ensureClassHasAvailableCapacity(input);
  }

  /**
   * @param {{ classId?: string|number|null, lockForUpdate?: boolean, occupancySource?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  ensureClassOccupancyWithinCapacity(input = {}) {
    return this.getClassService().ensureClassOccupancyWithinCapacity(input);
  }

  /**
   * @returns {ClassApplicationService}
   */
  getClassService() {
    if (!this.classService || typeof this.classService !== "object") {
      throw new TypeError("ClassFacade requires a class application service.");
    }

    return this.classService;
  }
}

module.exports = {
  ClassFacade,
};
