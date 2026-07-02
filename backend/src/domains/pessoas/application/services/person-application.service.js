const { PersonRepository } = require("../../person.repository.js");

/**
 * Application service responsible for Pessoa operations.
 *
 * Sprint 9.4 only delegates person creation to the existing PersonRepository.
 * It intentionally adds no business rule and changes no persistence behavior.
 */
class PersonApplicationService {
  /**
   * @param {Object} [options]
   * @param {{ create: (payload: Record<string, unknown>) => Promise<unknown> }} [options.personRepository]
   */
  constructor({ personRepository = null } = {}) {
    this.personRepository = personRepository;
  }

  /**
   * Creates a Pessoa through the existing repository boundary.
   *
   * @param {Record<string, unknown>} payload
   * @returns {Promise<unknown>}
   */
  async createPerson(payload = {}) {
    const personRepository = this.getPersonRepository();

    return personRepository.create(payload);
  }

  /**
   * @returns {{ create: (payload: Record<string, unknown>) => Promise<unknown> }}
   */
  getPersonRepository() {
    if (!this.personRepository) {
      this.personRepository = new PersonRepository();
    }

    if (typeof this.personRepository.create !== "function") {
      throw new TypeError("PersonApplicationService requires a personRepository.create function.");
    }

    return this.personRepository;
  }
}

module.exports = {
  PersonApplicationService,
};
