const {
  PERSON_PROFILE_STATUS,
  PERSON_PROFILE_TYPES,
} = require("../../profiles/person-profile.mapper.js");
const { PersonProfileRepository } = require("../../profiles/person-profile.repository.js");

/**
 * Application service responsible for Pessoa profile operations.
 *
 * Sprint 9.7 creates the responsible profile through the existing
 * PersonProfileRepository. Sprint 9.9 adds the student profile operation so
 * StudentApplicationService can keep profile persistence behind this boundary.
 * It does not create relationships, enrollments, contracts, finance entries,
 * classes, endpoints or new persistence objects.
 */
class ProfileApplicationService {
  /**
   * @param {Object} [options]
   * @param {{ create: (payload: Record<string, unknown>) => Promise<unknown> }} [options.personProfileRepository]
   */
  constructor({ personProfileRepository = null } = {}) {
    this.personProfileRepository = personProfileRepository;
  }

  /**
   * Creates the Responsavel profile for an already persisted Pessoa.
   *
   * @param {Record<string, unknown>} person
   * @returns {Promise<unknown>}
   */
  async createResponsibleProfile(person = {}) {
    const personId = readPersonId(person);

    if (!personId) {
      throw new TypeError("ProfileApplicationService requires a persisted person id.");
    }

    return this.getPersonProfileRepository().create({
      personId,
      profileType: PERSON_PROFILE_TYPES.RESPONSAVEL,
      status: PERSON_PROFILE_STATUS.ATIVO,
    });
  }

  /**
   * Creates the Aluno profile for an already persisted or resolved Pessoa.
   *
   * @param {Record<string, unknown>} person
   * @returns {Promise<unknown>}
   */
  async createStudentProfile(person = {}) {
    const personId = readPersonId(person);

    if (!personId) {
      throw new TypeError("ProfileApplicationService requires a persisted student person id.");
    }

    return this.getPersonProfileRepository().create({
      personId,
      profileType: PERSON_PROFILE_TYPES.ALUNO,
      status: PERSON_PROFILE_STATUS.ATIVO,
    });
  }

  /**
   * @returns {{ create: (payload: Record<string, unknown>) => Promise<unknown> }}
   */
  getPersonProfileRepository() {
    if (!this.personProfileRepository) {
      this.personProfileRepository = new PersonProfileRepository();
    }

    if (typeof this.personProfileRepository.create !== "function") {
      throw new TypeError("ProfileApplicationService requires a personProfileRepository.create function.");
    }

    return this.personProfileRepository;
  }
}

/**
 * @param {unknown} person
 * @returns {string|null}
 */
function readPersonId(person) {
  const id = person && typeof person === "object" ? person.id ?? person.personId ?? person.person_id : null;
  const normalized = String(id ?? "").trim();

  return normalized || null;
}

module.exports = {
  ProfileApplicationService,
  readPersonId,
};
