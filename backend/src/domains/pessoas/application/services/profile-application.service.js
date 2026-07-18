const {
  PERSON_PROFILE_STATUS,
  PERSON_PROFILE_TYPES,
} = require("../../profiles/person-profile.mapper.js");
const { PersonProfileRepository } = require("../../profiles/person-profile.repository.js");
const { AppError } = require("../../../../errors/app-error.js");

const STUDENT_PROFILE_RESOLUTIONS = Object.freeze({
  CREATED: "CREATED",
  FOUND: "FOUND",
});
const PROFILE_APPLICATION_ERROR_CODES = Object.freeze({
  CREATION_FAILED: "PROFILE_CREATION_FAILED",
  STUDENT_PROFILE_CONFLICT: "STUDENT_PROFILE_CONFLICT",
});

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

  /** Resolves or creates the single modern Aluno profile for a Pessoa. */
  async resolveOrCreateStudentProfile(person = {}) {
    const personId = readPersonId(person);
    if (!personId) {
      throw new TypeError("ProfileApplicationService requires a persisted student person id.");
    }
    const repository = this.getStudentProfileResolutionRepository();
    const candidates = await repository.findCandidatesByPersonAndType(
      personId,
      PERSON_PROFILE_TYPES.ALUNO,
    );
    if (candidates.length > 1) {
      throw profileError(
        "Student profile conflict requires assisted review.",
        PROFILE_APPLICATION_ERROR_CODES.STUDENT_PROFILE_CONFLICT,
        409,
      );
    }
    if (candidates.length === 1) {
      return profileResult(candidates[0], STUDENT_PROFILE_RESOLUTIONS.FOUND, true);
    }
    try {
      const created = await this.createStudentProfile({ personId });
      return profileResult(created, STUDENT_PROFILE_RESOLUTIONS.CREATED, false);
    } catch {
      throw profileError(
        "Student profile creation failed.",
        PROFILE_APPLICATION_ERROR_CODES.CREATION_FAILED,
        500,
      );
    }
  }

  getStudentProfileResolutionRepository() {
    const repository = this.getPersonProfileRepository();
    if (typeof repository.findCandidatesByPersonAndType !== "function") {
      throw new TypeError(
        "ProfileApplicationService requires a personProfileRepository.findCandidatesByPersonAndType function.",
      );
    }
    return repository;
  }

  /**
   * @returns {{ create: (payload: Record<string, unknown>) => Promise<unknown> }}
   */
  getPersonProfileRepository() {
    if (!this.personProfileRepository) {
      this.personProfileRepository = new PersonProfileRepository();
    }

    if (typeof this.personProfileRepository.create !== "function") {
      throw new TypeError(
        "ProfileApplicationService requires a personProfileRepository.create function.",
      );
    }

    return this.personProfileRepository;
  }
}

function profileResult(profile, profileResolution, reused) {
  const personProfileId = readProfileId(profile);
  if (!personProfileId) {
    throw profileError(
      "Student profile creation failed.",
      PROFILE_APPLICATION_ERROR_CODES.CREATION_FAILED,
      500,
    );
  }
  return Object.freeze({ personProfileId, profileResolution, reused });
}

function readProfileId(profile) {
  const id = profile && typeof profile === "object" ? profile.id : null;
  const normalized = String(id ?? "").trim();
  return normalized || null;
}

function profileError(message, code, statusCode) {
  return new AppError(message, { code, expose: statusCode < 500, statusCode });
}

/**
 * @param {unknown} person
 * @returns {string|null}
 */
function readPersonId(person) {
  const id =
    person && typeof person === "object"
      ? (person.id ?? person.personId ?? person.person_id)
      : null;
  const normalized = String(id ?? "").trim();

  return normalized || null;
}

module.exports = {
  PROFILE_APPLICATION_ERROR_CODES,
  ProfileApplicationService,
  STUDENT_PROFILE_RESOLUTIONS,
  readPersonId,
};
