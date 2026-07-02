/**
 * Domain model for the future Professor profile.
 *
 * This file documents the role, responsibilities and domain attributes of a
 * person acting as a professor. It has no persistence, no SQL, no endpoints
 * and no integration with the current professores module.
 */

const PROFESSOR_PROFILE_ROLE = Object.freeze({
  key: "professor",
  name: "Professor",
  description: "Pessoa responsavel por conduzir aulas, turmas e atividades esportivas.",
});

const PROFESSOR_PROFILE_RESPONSIBILITIES = Object.freeze([
  "Representar o vinculo tecnico e operacional do professor.",
  "Concentrar modalidades, turmas, unidades, jornada e contrato.",
  "Permitir relacionamento futuro com agenda, presencas, contratos e financeiro.",
]);

const PROFESSOR_PROFILE_ATTRIBUTES = Object.freeze([
  "personId",
  "status",
  "modalidades",
  "unidadeIds",
  "turmaIds",
  "tipoContrato",
  "jornada",
  "registroProfissional",
  "disponibilidade",
  "observacoes",
]);

/**
 * @typedef {Object} ProfessorProfileData
 * @property {string|null} [personId] Future identifier of the related Person.
 * @property {string|null} [status] Domain status for the professor profile.
 * @property {string[]} [modalidades] Sports modalities taught by the professor.
 * @property {string[]} [unidadeIds] Future unit identifiers.
 * @property {string[]} [turmaIds] Future class identifiers.
 * @property {string|null} [tipoContrato] Future contract type.
 * @property {string|null} [jornada] Workload or schedule summary.
 * @property {string|null} [registroProfissional] Professional registration, when applicable.
 * @property {string|null} [disponibilidade] Availability summary.
 * @property {string|null} [observacoes] Operational notes for the profile.
 */

class ProfessorProfile {
  /**
   * @param {ProfessorProfileData} [data]
   */
  constructor(data = {}) {
    this.personId = data.personId ?? null;
    this.status = data.status ?? null;
    this.modalidades = Array.isArray(data.modalidades) ? data.modalidades : [];
    this.unidadeIds = Array.isArray(data.unidadeIds) ? data.unidadeIds : [];
    this.turmaIds = Array.isArray(data.turmaIds) ? data.turmaIds : [];
    this.tipoContrato = data.tipoContrato ?? null;
    this.jornada = data.jornada ?? null;
    this.registroProfissional = data.registroProfissional ?? null;
    this.disponibilidade = data.disponibilidade ?? null;
    this.observacoes = data.observacoes ?? null;
  }

  /**
   * Returns the profile as plain data for future mappers.
   *
   * @returns {ProfessorProfileData}
   */
  toJSON() {
    return {
      disponibilidade: this.disponibilidade,
      jornada: this.jornada,
      modalidades: this.modalidades,
      observacoes: this.observacoes,
      personId: this.personId,
      registroProfissional: this.registroProfissional,
      status: this.status,
      tipoContrato: this.tipoContrato,
      turmaIds: this.turmaIds,
      unidadeIds: this.unidadeIds,
    };
  }
}

ProfessorProfile.role = PROFESSOR_PROFILE_ROLE;
ProfessorProfile.responsibilities = PROFESSOR_PROFILE_RESPONSIBILITIES;
ProfessorProfile.attributes = PROFESSOR_PROFILE_ATTRIBUTES;

module.exports = {
  PROFESSOR_PROFILE_ATTRIBUTES,
  PROFESSOR_PROFILE_RESPONSIBILITIES,
  PROFESSOR_PROFILE_ROLE,
  ProfessorProfile,
};
