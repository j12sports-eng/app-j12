const { PRE_MATRICULA_STATUS, PRE_MATRICULA_STATUS_VALUES } = require("./prematricula.types.js");

/**
 * Domain entity for pre-registration.
 *
 * This entity is a local domain model only. It has no HTTP behavior and no
 * integration with current enrollment flows.
 */
class Prematricula {
  /**
   * @param {import("./prematricula.types.js").PrematriculaData} [data]
   */
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.status = PRE_MATRICULA_STATUS_VALUES.includes(data.status)
      ? data.status
      : PRE_MATRICULA_STATUS.PENDENTE;
    this.aluno = normalizeAluno(data.aluno);
    this.responsavel = normalizeResponsavel(data.responsavel);
    this.pessoaAlunoId = data.pessoaAlunoId ?? null;
    this.pessoaResponsavelId = data.pessoaResponsavelId ?? null;
    this.origem = data.origem ?? "pre_matricula";
    this.metadata = data.metadata ?? null;
    this.createdAt = data.createdAt ?? null;
    this.updatedAt = data.updatedAt ?? null;
  }

  /**
   * Returns a plain object representation for future mappers/adapters.
   *
   * @returns {import("./prematricula.types.js").PrematriculaData}
   */
  toJSON() {
    return {
      aluno: this.aluno,
      createdAt: this.createdAt,
      id: this.id,
      metadata: this.metadata,
      origem: this.origem,
      pessoaAlunoId: this.pessoaAlunoId,
      pessoaResponsavelId: this.pessoaResponsavelId,
      responsavel: this.responsavel,
      status: this.status,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Normalizes the future student payload without applying persistence logic.
 *
 * @param {Partial<import("./prematricula.types.js").PrematriculaAlunoData>} [aluno]
 * @returns {import("./prematricula.types.js").PrematriculaAlunoData}
 */
function normalizeAluno(aluno = {}) {
  return {
    dataNascimento: aluno.dataNascimento ?? null,
    modalidade: aluno.modalidade ?? null,
    nome: aluno.nome ?? null,
    observacoes: aluno.observacoes ?? null,
    sexo: aluno.sexo ?? null,
    unidadeInteresse: aluno.unidadeInteresse ?? null,
  };
}

/**
 * Normalizes the future responsible person payload without applying persistence logic.
 *
 * @param {Partial<import("./prematricula.types.js").PrematriculaResponsavelData>} [responsavel]
 * @returns {import("./prematricula.types.js").PrematriculaResponsavelData}
 */
function normalizeResponsavel(responsavel = {}) {
  return {
    cpf: responsavel.cpf ?? null,
    email: responsavel.email ?? null,
    nome: responsavel.nome ?? null,
    telefone: responsavel.telefone ?? null,
    whatsapp: responsavel.whatsapp ?? null,
  };
}

module.exports = {
  Prematricula,
  normalizeAluno,
  normalizeResponsavel,
};
