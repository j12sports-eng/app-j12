const {
  PERSON_RELATIONSHIP_STATUS_VALUES,
} = require("./relationship.types.js");

/**
 * Validator for the isolated Person Relationships domain.
 *
 * It validates only table-level constraints. It does not enforce aluno,
 * responsavel, financeiro, auth or operational business rules.
 */
class PersonRelationshipValidator {
  /**
   * @param {import("./relationship.types.js").PersonRelationshipData} payload
   * @returns {{ valid: boolean, errors: string[], payload: import("./relationship.types.js").PersonRelationshipData }}
   */
  validate(payload = {}) {
    const errors = [];

    if (!String(payload.personId ?? "").trim()) {
      errors.push("personId e obrigatorio.");
    }

    if (!String(payload.relatedPersonId ?? "").trim()) {
      errors.push("relatedPersonId e obrigatorio.");
    }

    if (!String(payload.relationshipType ?? "").trim()) {
      errors.push("relationshipType e obrigatorio.");
    }

    if (!String(payload.status ?? "").trim()) {
      errors.push("status e obrigatorio.");
    } else if (!PERSON_RELATIONSHIP_STATUS_VALUES.includes(payload.status)) {
      errors.push(`status invalido: ${payload.status}.`);
    }

    if (!isValidDateRange(payload.validFrom, payload.validUntil)) {
      errors.push("validUntil nao pode ser anterior a validFrom.");
    }

    return {
      errors,
      payload,
      valid: errors.length === 0,
    };
  }
}

/**
 * @param {unknown} validFrom
 * @param {unknown} validUntil
 * @returns {boolean}
 */
function isValidDateRange(validFrom, validUntil) {
  if (!validFrom || !validUntil) return true;

  return String(validUntil) >= String(validFrom);
}

module.exports = {
  PersonRelationshipValidator,
  isValidDateRange,
};
