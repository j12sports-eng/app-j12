const { Prematricula } = require("./prematricula.entity.js");
const { PrematriculaRepository } = require("./prematricula.repository.js");
const { PrematriculaValidator } = require("./prematricula.validator.js");

/**
 * Service for isolated Pre-Matricula use cases.
 *
 * The service only coordinates the new domain repository and validator. It does
 * not call legacy modules, routes, controllers or frontend code.
 */
class PrematriculaService {
  /**
   * @param {Object} [options]
   * @param {PrematriculaRepository} [options.repository] Pre-Matricula repository.
   * @param {PrematriculaValidator} [options.validator] Domain validator.
   */
  constructor({
    repository = new PrematriculaRepository(),
    validator = new PrematriculaValidator(),
  } = {}) {
    this.repository = repository;
    this.validator = validator;
  }

  /**
   * Ensures the isolated table exists.
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
   * Builds a validated Pre-Matricula entity without persistence.
   *
   * @param {import("./prematricula.types.js").PrematriculaData} payload
   * @returns {{ valid: boolean, errors: string[], data: Prematricula|null }}
   */
  prepare(payload) {
    const result = this.validator.validate(payload);

    if (!result.valid) {
      return {
        data: null,
        errors: result.errors,
        valid: false,
      };
    }

    return {
      data: new Prematricula(payload),
      errors: [],
      valid: true,
    };
  }

  /**
   * Creates a pre-registration in the isolated table.
   *
   * @param {import("./prematricula.types.js").PrematriculaData} payload
   * @returns {Promise<{ valid: boolean, errors: string[], data: import("./prematricula.types.js").PrematriculaData|null }>}
   */
  async create(payload) {
    const prepared = this.prepare(payload);

    if (!prepared.valid) {
      return prepared;
    }

    const data = await this.repository.create(prepared.data.toJSON());

    return {
      data,
      errors: [],
      valid: true,
    };
  }

  /**
   * Finds a pre-registration by id.
   *
   * @param {string} id
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.repository.findById(id);
  }

  /**
   * Lists pre-registrations.
   *
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData[]>}
   */
  async list(filters = {}) {
    return this.repository.list(filters);
  }

  /**
   * Updates a pre-registration with validated full data.
   *
   * @param {string} id
   * @param {Partial<import("./prematricula.types.js").PrematriculaData>} patch
   * @returns {Promise<{ found: boolean, valid: boolean, errors: string[], data: import("./prematricula.types.js").PrematriculaData|null }>}
   */
  async update(id, patch) {
    if (!id) {
      return {
        data: null,
        errors: ["Id da pre-matricula e obrigatorio."],
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

    const next = mergePrematricula(current, patch);
    const prepared = this.prepare(next);

    if (!prepared.valid) {
      return {
        data: null,
        errors: prepared.errors,
        found: true,
        valid: false,
      };
    }

    const data = await this.repository.update(id, prepared.data.toJSON());

    return {
      data,
      errors: [],
      found: true,
      valid: true,
    };
  }

  /**
   * Updates only the status of a pre-registration.
   *
   * @param {string} id
   * @param {string} status
   * @returns {Promise<{ found: boolean, valid: boolean, errors: string[], data: import("./prematricula.types.js").PrematriculaData|null }>}
   */
  async updateStatus(id, status) {
    return this.update(id, { status });
  }

  /**
   * Deletes a pre-registration by id.
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
 * Merges a partial patch into full Pre-Matricula data.
 *
 * @param {import("./prematricula.types.js").PrematriculaData} current
 * @param {Partial<import("./prematricula.types.js").PrematriculaData>} patch
 * @returns {import("./prematricula.types.js").PrematriculaData}
 */
function mergePrematricula(current, patch = {}) {
  return {
    ...current,
    ...patch,
    aluno: {
      ...current.aluno,
      ...(patch.aluno || {}),
    },
    responsavel: {
      ...current.responsavel,
      ...(patch.responsavel || {}),
    },
  };
}

module.exports = {
  PrematriculaService,
  mergePrematricula,
};
