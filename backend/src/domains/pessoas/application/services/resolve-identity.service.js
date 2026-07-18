const { normalizeCpf } = require("../../person-identity-normalizer.js");
const { PersonRepository } = require("../../person.repository.js");

const IDENTITY_RESOLUTION_STATUSES = Object.freeze({
  CONFLICT: "CONFLICT",
  FOUND: "FOUND",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  NOT_FOUND: "NOT_FOUND",
});
const IDENTITY_MATCH_TYPES = Object.freeze({ CPF: "CPF", PERSON_ID: "PERSON_ID" });

class IdentityResolutionInfrastructureError extends Error {
  constructor() {
    super("Identity resolution is temporarily unavailable.");
    this.code = "IDENTITY_RESOLUTION_UNAVAILABLE";
    this.name = "IdentityResolutionInfrastructureError";
  }
}

/** Canonical read-only resolver. It never creates, updates or merges Pessoas. */
class ResolveIdentityService {
  constructor({ personRepository = new PersonRepository() } = {}) {
    this.personRepository = personRepository;
  }

  async resolve(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return result(IDENTITY_RESOLUTION_STATUSES.INSUFFICIENT_DATA);
    }
    const personId = normalizePersonId(input.personId ?? input.id);
    const cpfNormalized = normalizeCpfSafely(input.cpfNormalized ?? input.cpf);
    if (personId) {
      const person = await this.readSafely(() => this.repository().findById(personId));
      if (person) {
        return result(IDENTITY_RESOLUTION_STATUSES.FOUND, {
          matchedBy: IDENTITY_MATCH_TYPES.PERSON_ID,
          personId: typeof person.id === "string" && person.id.trim() ? person.id : personId,
        });
      }
    }
    if (cpfNormalized) return this.resolveByCpf(cpfNormalized);
    if (personId) {
      return result(IDENTITY_RESOLUTION_STATUSES.NOT_FOUND, {
        matchedBy: IDENTITY_MATCH_TYPES.PERSON_ID,
      });
    }
    return result(IDENTITY_RESOLUTION_STATUSES.INSUFFICIENT_DATA);
  }

  async resolveByCpf(cpfNormalized) {
    const candidates = await this.readSafely(() =>
      this.repository().findIdentityCandidatesByNormalizedCpf(cpfNormalized),
    );
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return result(IDENTITY_RESOLUTION_STATUSES.NOT_FOUND, {
        matchedBy: IDENTITY_MATCH_TYPES.CPF,
      });
    }
    if (candidates.length > 1) {
      return result(IDENTITY_RESOLUTION_STATUSES.CONFLICT, { matchedBy: IDENTITY_MATCH_TYPES.CPF });
    }
    return result(IDENTITY_RESOLUTION_STATUSES.FOUND, {
      matchedBy: IDENTITY_MATCH_TYPES.CPF,
      personId: candidates[0].id,
    });
  }

  repository() {
    if (
      typeof this.personRepository?.findById !== "function" ||
      typeof this.personRepository?.findIdentityCandidatesByNormalizedCpf !== "function"
    ) {
      throw new IdentityResolutionInfrastructureError();
    }
    return this.personRepository;
  }

  async readSafely(read) {
    try {
      return await read();
    } catch {
      throw new IdentityResolutionInfrastructureError();
    }
  }
}

function normalizePersonId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 64 ? normalized : null;
}
function normalizeCpfSafely(value) {
  try {
    return normalizeCpf(value);
  } catch {
    return null;
  }
}
function result(status, details = {}) {
  return Object.freeze({ status, ...details });
}

module.exports = Object.freeze({
  IDENTITY_MATCH_TYPES,
  IDENTITY_RESOLUTION_STATUSES,
  IdentityResolutionInfrastructureError,
  ResolveIdentityService,
});
