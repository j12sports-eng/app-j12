/**
 * Domain model for the future Responsavel profile.
 *
 * This file documents the role, responsibilities and domain attributes of a
 * person acting as a responsavel. It has no persistence, no SQL, no endpoints
 * and no integration with the current responsaveis module.
 */

const RESPONSAVEL_PROFILE_ROLE = Object.freeze({
  key: "responsavel",
  name: "Responsavel",
  description: "Pessoa responsavel por acompanhar e autorizar a jornada de um aluno.",
});

const RESPONSAVEL_PROFILE_RESPONSIBILITIES = Object.freeze([
  "Representar o vinculo familiar, legal ou operacional com alunos.",
  "Concentrar dados de parentesco, contato principal e autorizacoes.",
  "Permitir relacionamento futuro com aluno, contratos, financeiro e comunicacoes.",
]);

const RESPONSAVEL_PROFILE_ATTRIBUTES = Object.freeze([
  "personId",
  "status",
  "parentesco",
  "alunoIds",
  "responsavelFinanceiro",
  "responsavelPedagogico",
  "contatoPrincipal",
  "autorizadoRetirada",
  "observacoes",
]);

/**
 * @typedef {Object} ResponsavelProfileData
 * @property {string|null} [personId] Future identifier of the related Person.
 * @property {string|null} [status] Domain status for the responsavel profile.
 * @property {string|null} [parentesco] Relationship with linked alunos.
 * @property {string[]} [alunoIds] Future linked aluno identifiers.
 * @property {boolean|null} [responsavelFinanceiro] Indicates financial responsibility.
 * @property {boolean|null} [responsavelPedagogico] Indicates academic/sports responsibility.
 * @property {boolean|null} [contatoPrincipal] Indicates preferred contact ownership.
 * @property {boolean|null} [autorizadoRetirada] Indicates pickup authorization.
 * @property {string|null} [observacoes] Operational notes for the profile.
 */

class ResponsavelProfile {
  /**
   * @param {ResponsavelProfileData} [data]
   */
  constructor(data = {}) {
    this.personId = data.personId ?? null;
    this.status = data.status ?? null;
    this.parentesco = data.parentesco ?? null;
    this.alunoIds = Array.isArray(data.alunoIds) ? data.alunoIds : [];
    this.responsavelFinanceiro = data.responsavelFinanceiro ?? null;
    this.responsavelPedagogico = data.responsavelPedagogico ?? null;
    this.contatoPrincipal = data.contatoPrincipal ?? null;
    this.autorizadoRetirada = data.autorizadoRetirada ?? null;
    this.observacoes = data.observacoes ?? null;
  }

  /**
   * Returns the profile as plain data for future mappers.
   *
   * @returns {ResponsavelProfileData}
   */
  toJSON() {
    return {
      alunoIds: this.alunoIds,
      autorizadoRetirada: this.autorizadoRetirada,
      contatoPrincipal: this.contatoPrincipal,
      observacoes: this.observacoes,
      parentesco: this.parentesco,
      personId: this.personId,
      responsavelFinanceiro: this.responsavelFinanceiro,
      responsavelPedagogico: this.responsavelPedagogico,
      status: this.status,
    };
  }
}

ResponsavelProfile.role = RESPONSAVEL_PROFILE_ROLE;
ResponsavelProfile.responsibilities = RESPONSAVEL_PROFILE_RESPONSIBILITIES;
ResponsavelProfile.attributes = RESPONSAVEL_PROFILE_ATTRIBUTES;

module.exports = {
  RESPONSAVEL_PROFILE_ATTRIBUTES,
  RESPONSAVEL_PROFILE_RESPONSIBILITIES,
  RESPONSAVEL_PROFILE_ROLE,
  ResponsavelProfile,
};
