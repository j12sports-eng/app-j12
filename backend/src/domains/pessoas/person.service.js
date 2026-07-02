const { PersonRepository } = require("./person.repository.js");

/**
 * Service for isolated Pessoa persistence use cases.
 *
 * This service coordinates only the new `people` repository. It does not call
 * aluno, responsavel, auth, dashboard or financeiro modules.
 */
class PersonService {
  /**
   * @param {Object} [options]
   * @param {PersonRepository} [options.repository]
   */
  constructor({ repository = new PersonRepository() } = {}) {
    this.repository = repository;
  }

  /**
   * Ensures the independent `people` table exists.
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
   * Creates a Pessoa after validating minimum common data.
   *
   * @param {import("./person.mapper.js").PersonPersistenceData & Partial<import("./person.types.js").PersonData>} payload
   * @returns {Promise<{ valid: boolean, errors: string[], data: unknown }>}
   */
  async create(payload) {
    const validation = validatePersonPayload(payload);
    if (!validation.valid) {
      return {
        data: null,
        errors: validation.errors,
        valid: false,
      };
    }

    const data = await this.repository.create(payload);

    return {
      data,
      errors: [],
      valid: true,
    };
  }

  /**
   * Finds a Pessoa by id.
   *
   * @param {string} id
   * @returns {Promise<unknown|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.repository.findById(id);
  }

  /**
   * Finds a Pessoa by CPF.
   *
   * @param {string} cpf
   * @returns {Promise<unknown|null>}
   */
  async findByCpf(cpf) {
    if (!cpf) return null;
    return this.repository.findByCpf(cpf);
  }

  /**
   * Lists Pessoas.
   *
   * @param {Object} [filters]
   * @returns {Promise<unknown[]>}
   */
  async list(filters = {}) {
    return this.repository.list(filters);
  }

  /**
   * Updates a Pessoa by merging the current row with a patch.
   *
   * @param {string} id
   * @param {Partial<import("./person.mapper.js").PersonPersistenceData & import("./person.types.js").PersonData>} patch
   * @returns {Promise<{ found: boolean, valid: boolean, errors: string[], data: unknown }>}
   */
  async update(id, patch) {
    if (!id) {
      return {
        data: null,
        errors: ["Id da pessoa e obrigatorio."],
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

    const next = mergePerson(current, patch);
    const validation = validatePersonPayload(next);

    if (!validation.valid) {
      return {
        data: null,
        errors: validation.errors,
        found: true,
        valid: false,
      };
    }

    const data = await this.repository.update(id, next);

    return {
      data,
      errors: [],
      found: true,
      valid: true,
    };
  }

  /**
   * Deletes a Pessoa by id.
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
 * Validates the minimum common data required by the independent table.
 *
 * @param {Partial<import("./person.mapper.js").PersonPersistenceData & import("./person.types.js").PersonData>} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersonPayload(payload = {}) {
  const errors = [];
  const nome = payload.nome ?? payload.name?.fullName ?? payload.name?.displayName;

  if (!String(nome ?? "").trim()) {
    errors.push("Nome da pessoa e obrigatorio.");
  }

  return {
    errors,
    valid: errors.length === 0,
  };
}

/**
 * Merges a partial Pessoa patch into the current persisted data.
 *
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>}
 */
function mergePerson(current, patch = {}) {
  return {
    ...current,
    ...patch,
    address: {
      ...(current.address || {}),
      ...(patch.address || {}),
    },
    contact: {
      ...(current.contact || {}),
      ...(patch.contact || {}),
    },
    name: {
      ...(current.name || {}),
      ...(patch.name || {}),
    },
  };
}

module.exports = {
  PersonService,
  mergePerson,
  validatePersonPayload,
};
