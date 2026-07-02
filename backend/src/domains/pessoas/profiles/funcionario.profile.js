/**
 * Domain model for the future Funcionario profile.
 *
 * This file documents the role, responsibilities and domain attributes of a
 * person acting as a funcionario. It has no persistence, no SQL, no endpoints
 * and no integration with any current funcionarios module.
 */

const FUNCIONARIO_PROFILE_ROLE = Object.freeze({
  key: "funcionario",
  name: "Funcionario",
  description: "Pessoa vinculada a operacoes internas, administracao ou atendimento da J12.",
});

const FUNCIONARIO_PROFILE_RESPONSIBILITIES = Object.freeze([
  "Representar o vinculo operacional e administrativo do funcionario.",
  "Concentrar cargo, departamento, unidade, contrato e permissoes operacionais.",
  "Permitir relacionamento futuro com usuarios, permissoes, financeiro e tarefas internas.",
]);

const FUNCIONARIO_PROFILE_ATTRIBUTES = Object.freeze([
  "personId",
  "status",
  "cargo",
  "departamento",
  "unidadeId",
  "permissoesOperacionais",
  "tipoContrato",
  "dataAdmissao",
  "observacoes",
]);

/**
 * @typedef {Object} FuncionarioProfileData
 * @property {string|null} [personId] Future identifier of the related Person.
 * @property {string|null} [status] Domain status for the funcionario profile.
 * @property {string|null} [cargo] Role or job title.
 * @property {string|null} [departamento] Internal department.
 * @property {string|null} [unidadeId] Future unit identifier.
 * @property {string[]} [permissoesOperacionais] Future operational permissions.
 * @property {string|null} [tipoContrato] Future contract type.
 * @property {string|null} [dataAdmissao] Future admission date.
 * @property {string|null} [observacoes] Operational notes for the profile.
 */

class FuncionarioProfile {
  /**
   * @param {FuncionarioProfileData} [data]
   */
  constructor(data = {}) {
    this.personId = data.personId ?? null;
    this.status = data.status ?? null;
    this.cargo = data.cargo ?? null;
    this.departamento = data.departamento ?? null;
    this.unidadeId = data.unidadeId ?? null;
    this.permissoesOperacionais = Array.isArray(data.permissoesOperacionais)
      ? data.permissoesOperacionais
      : [];
    this.tipoContrato = data.tipoContrato ?? null;
    this.dataAdmissao = data.dataAdmissao ?? null;
    this.observacoes = data.observacoes ?? null;
  }

  /**
   * Returns the profile as plain data for future mappers.
   *
   * @returns {FuncionarioProfileData}
   */
  toJSON() {
    return {
      cargo: this.cargo,
      dataAdmissao: this.dataAdmissao,
      departamento: this.departamento,
      observacoes: this.observacoes,
      permissoesOperacionais: this.permissoesOperacionais,
      personId: this.personId,
      status: this.status,
      tipoContrato: this.tipoContrato,
      unidadeId: this.unidadeId,
    };
  }
}

FuncionarioProfile.role = FUNCIONARIO_PROFILE_ROLE;
FuncionarioProfile.responsibilities = FUNCIONARIO_PROFILE_RESPONSIBILITIES;
FuncionarioProfile.attributes = FUNCIONARIO_PROFILE_ATTRIBUTES;

module.exports = {
  FUNCIONARIO_PROFILE_ATTRIBUTES,
  FUNCIONARIO_PROFILE_RESPONSIBILITIES,
  FUNCIONARIO_PROFILE_ROLE,
  FuncionarioProfile,
};
