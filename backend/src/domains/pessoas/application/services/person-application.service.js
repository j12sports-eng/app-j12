const { PersonRepository } = require("../../person.repository.js");
const { AppError } = require("../../../../errors/app-error.js");
const { normalizeCpf } = require("../../person-identity-normalizer.js");
const {
  IDENTITY_MATCH_TYPES,
  IDENTITY_RESOLUTION_STATUSES,
  ResolveIdentityService,
} = require("./resolve-identity.service.js");

const PERSON_APPLICATION_ERROR_CODES = Object.freeze({
  CREATION_FAILED: "PERSON_CREATION_FAILED",
  IDENTITY_CONFLICT: "PERSON_IDENTITY_CONFLICT",
  IDENTITY_REQUIRED: "PERSON_IDENTITY_REQUIRED",
  NOT_FOUND: "PERSON_NOT_FOUND",
});

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
  constructor({ personRepository = null, resolveIdentityService = null } = {}) {
    this.personRepository = personRepository;
    this.resolveIdentityService = resolveIdentityService;
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
   * Canonical gradual entrypoint for modern Pessoa creation or reuse.
   * It preserves createPerson() for existing consumers and never updates a match.
   */
  async resolveOrCreatePerson(payload = {}, context = {}) {
    validateCpfForModernWrite(payload);
    const resolution = await this.getResolveIdentityService().resolve(payload);

    if (resolution.status === IDENTITY_RESOLUTION_STATUSES.FOUND) {
      return creationResult(resolution, { created: false, reused: true });
    }
    if (resolution.status === IDENTITY_RESOLUTION_STATUSES.CONFLICT) {
      throw applicationError(
        "Identity conflict requires assisted review.",
        PERSON_APPLICATION_ERROR_CODES.IDENTITY_CONFLICT,
        409,
      );
    }
    if (
      resolution.status === IDENTITY_RESOLUTION_STATUSES.NOT_FOUND &&
      resolution.matchedBy === IDENTITY_MATCH_TYPES.PERSON_ID &&
      context.requireExistingPersonId === true
    ) {
      throw applicationError(
        "Person was not found.",
        PERSON_APPLICATION_ERROR_CODES.NOT_FOUND,
        404,
      );
    }
    if (
      resolution.status === IDENTITY_RESOLUTION_STATUSES.INSUFFICIENT_DATA &&
      context.requiresStrongIdentity === true
    ) {
      throw applicationError(
        "Strong identity is required for this operation.",
        PERSON_APPLICATION_ERROR_CODES.IDENTITY_REQUIRED,
        422,
      );
    }

    try {
      const person = await this.createPerson(payload);
      const personId = readPersonId(person);
      if (!personId) throw new Error("missing persisted id");
      return creationResult(resolution, { created: true, personId, reused: false });
    } catch {
      throw applicationError(
        "Person creation failed.",
        PERSON_APPLICATION_ERROR_CODES.CREATION_FAILED,
        500,
      );
    }
  }

  getResolveIdentityService() {
    if (!this.resolveIdentityService) {
      this.resolveIdentityService = new ResolveIdentityService({
        personRepository: this.getPersonRepository(),
      });
    }
    if (typeof this.resolveIdentityService?.resolve !== "function") {
      throw new TypeError(
        "PersonApplicationService requires a resolveIdentityService.resolve function.",
      );
    }
    return this.resolveIdentityService;
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

function validateCpfForModernWrite(payload) {
  const value = readCpf(payload);
  if (value !== undefined && value !== null && String(value).trim()) normalizeCpf(value);
}

function readCpf(payload) {
  if (Object.prototype.hasOwnProperty.call(payload, "cpf")) return payload.cpf;
  return Array.isArray(payload.documents)
    ? payload.documents.find((document) => document?.type === "cpf")?.value
    : undefined;
}

function readPersonId(person) {
  return typeof person?.id === "string" && person.id.trim() ? person.id : null;
}

function creationResult(resolution, state) {
  return Object.freeze({
    created: state.created,
    identityResolution: resolution.status,
    personId: state.personId ?? resolution.personId,
    reused: state.reused,
  });
}

function applicationError(message, code, statusCode) {
  return new AppError(message, { code, expose: statusCode < 500, statusCode });
}

module.exports = {
  PERSON_APPLICATION_ERROR_CODES,
  PersonApplicationService,
};
