/**
 * Shared domain contracts for the Pre-Matricula flow.
 *
 * These definitions are intentionally isolated from current modules. They do not
 * create routes, controllers or frontend contracts.
 */

const PRE_MATRICULA_STATUS = Object.freeze({
  APROVADA: "APROVADA",
  CANCELADA: "CANCELADA",
  EM_ANALISE: "EM_ANALISE",
  PENDENTE: "PENDENTE",
  REJEITADA: "REJEITADA",
});

const PRE_MATRICULA_STATUS_VALUES = Object.freeze(Object.values(PRE_MATRICULA_STATUS));

/**
 * @typedef {Object} PrematriculaAlunoData
 * @property {string|null} nome Student name.
 * @property {string|null} dataNascimento Student birth date.
 * @property {string|null} [sexo] Optional student sex/gender field.
 * @property {string|null} unidadeInteresse Desired J12 unit.
 * @property {string|null} modalidade Desired sports modality.
 * @property {string|null} [observacoes] Optional notes.
 */

/**
 * @typedef {Object} PrematriculaResponsavelData
 * @property {string|null} nome Responsible person name.
 * @property {string|null} cpf Responsible person CPF.
 * @property {string|null} telefone Responsible person phone.
 * @property {string|null} whatsapp Responsible person WhatsApp.
 * @property {string|null} email Responsible person email.
 */

/**
 * @typedef {Object} PrematriculaData
 * @property {string|null} [id] Future identifier.
 * @property {string} [status] Pre-registration status.
 * @property {PrematriculaAlunoData} aluno Student payload.
 * @property {PrematriculaResponsavelData} responsavel Responsible person payload.
 * @property {string|null} [pessoaAlunoId] Future Person identifier for the student.
 * @property {string|null} [pessoaResponsavelId] Future Person identifier for the responsible person.
 * @property {string|null} [origem] Pre-registration source.
 * @property {Record<string, unknown>|null} [metadata] Optional operational metadata.
 * @property {string|null} [createdAt] Future creation timestamp.
 * @property {string|null} [updatedAt] Future update timestamp.
 */

module.exports = {
  PRE_MATRICULA_STATUS,
  PRE_MATRICULA_STATUS_VALUES,
};
