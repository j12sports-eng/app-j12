const {
  toPersonRelationshipData,
} = require("./relationship.mapper.js");
const { PersonRelationshipRepository } = require("./relationship.repository.js");
const { PersonRelationshipValidator } = require("./relationship.validator.js");

/**
 * Service for isolated Person Relationships use cases.
 *
 * It coordinates only the new repository and validator. It does not integrate
 * with alunos, responsaveis, auth, dashboard, financeiro, frontend, routes or
 * APIs.
 */
class PersonRelationshipService {
  /**
   * @param {Object} [options]
   * @param {PersonRelationshipRepository} [options.repository]
   * @param {PersonRelationshipValidator} [options.validator]
   */
  constructor({
    repository = new PersonRelationshipRepository(),
    validator = new PersonRelationshipValidator(),
  } = {}) {
    this.repository = repository;
    this.validator = validator;
  }

  /**
   * Ensures the independent `person_relationships` table exists.
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
   * Creates a relationship after table-level validation.
   *
   * @param {import("./relationship.types.js").PersonRelationshipData} payload
   * @returns {Promise<{ valid: boolean, errors: string[], data: import("./relationship.types.js").PersonRelationshipData|null }>}
   */
  async create(payload) {
    const data = toPersonRelationshipData(payload);
    const validation = this.validator.validate(data);

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
   * Finds a relationship by id.
   *
   * @param {string} id
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.repository.findById(id);
  }

  /**
   * Lists relationships.
   *
   * @param {Object} [filters]
   * @returns {Promise<import("./relationship.types.js").PersonRelationshipData[]>}
   */
  async list(filters = {}) {
    return this.repository.list(filters);
  }

  /**
   * Updates a relationship by merging the current row with a patch.
   *
   * @param {string} id
   * @param {Partial<import("./relationship.types.js").PersonRelationshipData>} patch
   * @returns {Promise<{ found: boolean, valid: boolean, errors: string[], data: import("./relationship.types.js").PersonRelationshipData|null }>}
   */
  async update(id, patch) {
    if (!id) {
      return {
        data: null,
        errors: ["Id do relacionamento e obrigatorio."],
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

    const data = mergePersonRelationship(current, patch);
    const validation = this.validator.validate(data);

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
   * Deletes a relationship by id.
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
 * Merges a partial relationship patch into the current persisted data.
 *
 * @param {import("./relationship.types.js").PersonRelationshipData} current
 * @param {Partial<import("./relationship.types.js").PersonRelationshipData>} patch
 * @returns {import("./relationship.types.js").PersonRelationshipData}
 */
function mergePersonRelationship(current, patch = {}) {
  return toPersonRelationshipData({
    ...current,
    ...patch,
  });
}

module.exports = {
  PersonRelationshipService,
  mergePersonRelationship,
};
