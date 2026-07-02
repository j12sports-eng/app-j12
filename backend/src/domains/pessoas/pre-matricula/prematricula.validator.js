const { PRE_MATRICULA_STATUS_VALUES } = require("./prematricula.types.js");

const REQUIRED_ALUNO_FIELDS = Object.freeze([
  "nome",
  "dataNascimento",
  "unidadeInteresse",
  "modalidade",
]);

const REQUIRED_RESPONSAVEL_FIELDS = Object.freeze([
  "nome",
  "cpf",
  "telefone",
  "whatsapp",
  "email",
]);

/**
 * Validator for Pre-Matricula payloads.
 *
 * The validator is intentionally local to the new domain. It is not wired to
 * current APIs, controllers, existing services or frontend forms.
 */
class PrematriculaValidator {
  /**
   * Validates the minimal Pre-Matricula payload.
   *
   * @param {import("./prematricula.types.js").PrematriculaData} [payload]
   * @returns {{ valid: boolean, errors: string[], payload: import("./prematricula.types.js").PrematriculaData|undefined }}
   */
  validate(payload) {
    const errors = [];

    if (!payload || typeof payload !== "object") {
      return {
        errors: ["Payload da pre-matricula deve ser um objeto."],
        payload,
        valid: false,
      };
    }

    if (payload.status && !PRE_MATRICULA_STATUS_VALUES.includes(payload.status)) {
      errors.push("Status da pre-matricula invalido.");
    }

    validateRequiredFields(payload.aluno, "aluno", REQUIRED_ALUNO_FIELDS, errors);
    validateRequiredFields(payload.responsavel, "responsavel", REQUIRED_RESPONSAVEL_FIELDS, errors);

    if (payload.responsavel?.email && !isValidEmail(payload.responsavel.email)) {
      errors.push("Email do responsavel deve ter formato valido.");
    }

    return {
      errors,
      payload,
      valid: errors.length === 0,
    };
  }
}

/**
 * Validates required fields in a nested payload section.
 *
 * @param {unknown} section
 * @param {string} sectionName
 * @param {readonly string[]} fields
 * @param {string[]} errors
 * @returns {void}
 */
function validateRequiredFields(section, sectionName, fields, errors) {
  if (!section || typeof section !== "object") {
    errors.push(`Dados de ${sectionName} sao obrigatorios.`);
    return;
  }

  for (const field of fields) {
    const value = section[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${sectionName}.${field} e obrigatorio.`);
    }
  }
}

/**
 * Performs a minimal email format check for the domain model.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  PrematriculaValidator,
  REQUIRED_ALUNO_FIELDS,
  REQUIRED_RESPONSAVEL_FIELDS,
  isValidEmail,
};
