const {
  PERSON_PROFILE_STATUS_VALUES,
  PERSON_PROFILE_TYPE_VALUES,
  toPersonProfileData,
} = require("./person-profile.mapper.js");
const { PersonProfileRepository } = require("./person-profile.repository.js");

/**
 * Service for isolated Person Profile persistence use cases.
 *
 * It coordinates only the `person_profiles` repository. It does not integrate
 * with Aluno, Responsavel, Login, Auth, Dashboard, Financeiro, routes or APIs.
 */
class PersonProfileService {
  /**
   * @param {Object} [options]
   * @param {PersonProfileRepository} [options.repository]
   */
  constructor({ repository = new PersonProfileRepository() } = {}) {
    this.repository = repository;
  }

  /**
   * Ensures the independent `person_profiles` table exists.
   *
   * @returns {Promise<void>}
   */
  async ensureSchema() {
    await this.repository.ensureTable();
  }

  /**
   * Verifies database access.
   *
   * @returns {Promise<boolean>}
   */
  async ping() {
    return this.repository.ping();
  }

  /**
   * Creates a Person Profile after validating the isolated payload.
   *
   * @param {import("./person-profile.mapper.js").PersonProfileData} payload
   * @returns {Promise<{ valid: boolean, errors: string[], data: import("./person-profile.mapper.js").PersonProfileData|null }>}
   */
  async create(payload) {
    const data = toPersonProfileData(payload);
    const validation = validatePersonProfilePayload(data);

    if (!validation.valid) {
      return {
        data: null,
        errors: validation.errors,
        valid: false,
      };
    }

    const created = await this.repository.create(data);

    return {
      data: created,
      errors: [],
      valid: true,
    };
  }

  /**
   * Finds a Person Profile by id.
   *
   * @param {string} id
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.repository.findById(id);
  }

  /**
   * Lists Person Profiles.
   *
   * @param {Object} [filters]
   * @returns {Promise<import("./person-profile.mapper.js").PersonProfileData[]>}
   */
  async list(filters = {}) {
    return this.repository.list(filters);
  }

  /**
   * Updates a Person Profile by merging the current row with a patch.
   *
   * @param {string} id
   * @param {Partial<import("./person-profile.mapper.js").PersonProfileData>} patch
   * @returns {Promise<{ found: boolean, valid: boolean, errors: string[], data: import("./person-profile.mapper.js").PersonProfileData|null }>}
   */
  async update(id, patch) {
    if (!id) {
      return {
        data: null,
        errors: ["Id do perfil e obrigatorio."],
        found: false,
        valid: false,
      };
    }

    const current = await this.repository.findById(id);
    if (!current) {
      return {
        data: null,
        errors: [],
        found: false,
        valid: true,
      };
    }

    const data = mergePersonProfile(current, patch);
    const validation = validatePersonProfilePayload(data);

    if (!validation.valid) {
      return {
        data: null,
        errors: validation.errors,
        found: true,
        valid: false,
      };
    }

    const updated = await this.repository.update(id, data);

    return {
      data: updated,
      errors: [],
      found: true,
      valid: true,
    };
  }

  /**
   * Deletes a Person Profile by id.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id) return false;
    return this.repository.delete(id);
  }
}

/**
 * Validates the minimum fields required by `person_profiles`.
 *
 * @param {import("./person-profile.mapper.js").PersonProfileData} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersonProfilePayload(payload = {}) {
  const errors = [];

  if (!String(payload.personId ?? "").trim()) {
    errors.push("personId e obrigatorio.");
  }

  if (!String(payload.profileType ?? "").trim()) {
    errors.push("profileType e obrigatorio.");
  } else if (!PERSON_PROFILE_TYPE_VALUES.includes(payload.profileType)) {
    errors.push(`profileType invalido: ${payload.profileType}.`);
  }

  if (!String(payload.status ?? "").trim()) {
    errors.push("status e obrigatorio.");
  } else if (!PERSON_PROFILE_STATUS_VALUES.includes(payload.status)) {
    errors.push(`status invalido: ${payload.status}.`);
  }

  return {
    errors,
    valid: errors.length === 0,
  };
}

/**
 * Merges a partial patch into current Person Profile data.
 *
 * @param {import("./person-profile.mapper.js").PersonProfileData} current
 * @param {Partial<import("./person-profile.mapper.js").PersonProfileData>} patch
 * @returns {import("./person-profile.mapper.js").PersonProfileData}
 */
function mergePersonProfile(current, patch = {}) {
  return toPersonProfileData({
    ...current,
    ...patch,
  });
}

module.exports = {
  PersonProfileService,
  mergePersonProfile,
  validatePersonProfilePayload,
};
