/**
 * @typedef {Object} CreateEnrollmentRequestStudent
 * @property {string|null} [personId]
 * @property {string|null} [nome]
 * @property {string|null} [cpf]
 * @property {string|null} [sexo]
 * @property {string|null} [dataNascimento]
 */

/**
 * @typedef {Object} CreateEnrollmentRequestRelationship
 * @property {string|null} [tipo]
 * @property {boolean} [responsavelLegal]
 * @property {boolean} [financeiro]
 * @property {boolean} [financeiroPrincipal]
 * @property {boolean} [recebeComunicados]
 * @property {boolean} [podeBuscar]
 * @property {boolean} [emergencia]
 * @property {boolean} [emergenciaPrincipal]
 */

/**
 * @typedef {Object} CreateEnrollmentRequestResponsible
 * @property {string|null} [personId]
 * @property {string|null} [nome]
 * @property {string|null} [cpf]
 * @property {string|null} [telefone]
 * @property {string|null} [whatsapp]
 * @property {string|null} [email]
 * @property {CreateEnrollmentRequestRelationship|null} [relacionamento]
 */

/**
 * @typedef {Object} CreateEnrollmentRequestEnrollment
 * @property {string|null} [numeroMatricula]
 * @property {string|null} [dataMatricula]
 * @property {string|null} [statusInicial]
 * @property {string[]} [modalidadeIds]
 * @property {string[]} [unidadeIds]
 * @property {string[]} [turmaIds]
 * @property {string[]} [horarioIds]
 * @property {string|null} [planoId]
 */

/**
 * DTO for the future create enrollment application use case.
 *
 * This object is intentionally database-agnostic. It does not know tables,
 * repositories, SQL columns, Express requests or current ERP modules.
 */
class CreateEnrollmentRequest {
  /**
   * @param {Record<string, unknown>} [payload]
   */
  constructor(payload = {}) {
    this.raw = payload && typeof payload === "object" ? payload : {};
    this.aluno = normalizeObject(this.raw.aluno);
    this.responsaveis = normalizeResponsibles(this.raw.responsaveis);
    this.matricula = normalizeObject(this.raw.matricula);
    this.metadata = normalizeObject(this.raw.metadata);
  }

  /**
   * @returns {Record<string, unknown>}
   */
  toJSON() {
    return {
      aluno: this.aluno,
      matricula: this.matricula,
      metadata: this.metadata,
      responsaveis: this.responsaveis,
    };
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>[]}
 */
function normalizeResponsibles(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

module.exports = {
  CreateEnrollmentRequest,
  normalizeObject,
  normalizeResponsibles,
};
