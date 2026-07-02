/**
 * Domain model for the future Aluno profile.
 *
 * This file documents the role, responsibilities and domain attributes of a
 * person acting as an aluno. It has no persistence, no SQL, no endpoints and
 * no integration with the current alunos module.
 */

const ALUNO_PROFILE_ROLE = Object.freeze({
  key: "aluno",
  name: "Aluno",
  description: "Pessoa matriculada em atividades esportivas da J12.",
});

const ALUNO_PROFILE_RESPONSIBILITIES = Object.freeze([
  "Representar o vinculo esportivo e academico do aluno.",
  "Concentrar dados de matricula, turmas, modalidades e status do aluno.",
  "Permitir relacionamento futuro com responsaveis, financeiro, agenda e presencas.",
]);

const ALUNO_PROFILE_ATTRIBUTES = Object.freeze([
  "personId",
  "status",
  "matriculaId",
  "unidadeId",
  "turmaIds",
  "modalidades",
  "planoId",
  "dataIngresso",
  "observacoes",
]);

/**
 * @typedef {Object} AlunoProfileData
 * @property {string|null} [personId] Future identifier of the related Person.
 * @property {string|null} [status] Domain status for the aluno profile.
 * @property {string|null} [matriculaId] Future enrollment identifier.
 * @property {string|null} [unidadeId] Future unit identifier.
 * @property {string[]} [turmaIds] Future class identifiers.
 * @property {string[]} [modalidades] Sports modalities linked to the aluno.
 * @property {string|null} [planoId] Future plan identifier.
 * @property {string|null} [dataIngresso] Future enrollment/start date.
 * @property {string|null} [observacoes] Operational notes for the profile.
 */

class AlunoProfile {
  /**
   * @param {AlunoProfileData} [data]
   */
  constructor(data = {}) {
    this.personId = data.personId ?? null;
    this.status = data.status ?? null;
    this.matriculaId = data.matriculaId ?? null;
    this.unidadeId = data.unidadeId ?? null;
    this.turmaIds = Array.isArray(data.turmaIds) ? data.turmaIds : [];
    this.modalidades = Array.isArray(data.modalidades) ? data.modalidades : [];
    this.planoId = data.planoId ?? null;
    this.dataIngresso = data.dataIngresso ?? null;
    this.observacoes = data.observacoes ?? null;
  }

  /**
   * Returns the profile as plain data for future mappers.
   *
   * @returns {AlunoProfileData}
   */
  toJSON() {
    return {
      dataIngresso: this.dataIngresso,
      matriculaId: this.matriculaId,
      modalidades: this.modalidades,
      observacoes: this.observacoes,
      personId: this.personId,
      planoId: this.planoId,
      status: this.status,
      turmaIds: this.turmaIds,
      unidadeId: this.unidadeId,
    };
  }
}

AlunoProfile.role = ALUNO_PROFILE_ROLE;
AlunoProfile.responsibilities = ALUNO_PROFILE_RESPONSIBILITIES;
AlunoProfile.attributes = ALUNO_PROFILE_ATTRIBUTES;

module.exports = {
  ALUNO_PROFILE_ATTRIBUTES,
  ALUNO_PROFILE_RESPONSIBILITIES,
  ALUNO_PROFILE_ROLE,
  AlunoProfile,
};
