const { Prematricula } = require("./prematricula.entity.js");

/**
 * Maps plain data into the Pre-Matricula entity.
 *
 * This mapper does not depend on any current controller, service, route or
 * frontend payload.
 *
 * @param {import("./prematricula.types.js").PrematriculaData} [data]
 * @returns {Prematricula}
 */
function toPrematriculaEntity(data = {}) {
  return new Prematricula(data);
}

/**
 * Maps the future Pre-Matricula entity into plain data.
 *
 * @param {Prematricula|import("./prematricula.types.js").PrematriculaData|null|undefined} prematricula
 * @returns {import("./prematricula.types.js").PrematriculaData}
 */
function toPrematriculaData(prematricula) {
  if (prematricula instanceof Prematricula) {
    return prematricula.toJSON();
  }

  return new Prematricula(prematricula || {}).toJSON();
}

/**
 * Maps a database row from `pre_matriculas` into domain data.
 *
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {import("./prematricula.types.js").PrematriculaData|null}
 */
function toPrematriculaDataFromRow(row) {
  if (!row) return null;

  return toPrematriculaData({
    aluno: {
      dataNascimento: row.aluno_data_nascimento ?? null,
      modalidade: row.aluno_modalidade ?? null,
      nome: row.aluno_nome ?? null,
      observacoes: row.aluno_observacoes ?? null,
      sexo: row.aluno_sexo ?? null,
      unidadeInteresse: row.aluno_unidade_interesse ?? null,
    },
    createdAt: row.created_at ?? null,
    id: row.id ?? null,
    metadata: parseMetadata(row.metadata_json),
    origem: row.origem ?? null,
    pessoaAlunoId: row.pessoa_aluno_id ?? null,
    pessoaResponsavelId: row.pessoa_responsavel_id ?? null,
    responsavel: {
      cpf: row.responsavel_cpf ?? null,
      email: row.responsavel_email ?? null,
      nome: row.responsavel_nome ?? null,
      telefone: row.responsavel_telefone ?? null,
      whatsapp: row.responsavel_whatsapp ?? null,
    },
    status: row.status,
    updatedAt: row.updated_at ?? null,
  });
}

/**
 * Maps domain data into column values accepted by `pre_matriculas`.
 *
 * @param {import("./prematricula.types.js").PrematriculaData} data
 * @returns {Record<string, unknown>}
 */
function toPrematriculaRowValues(data) {
  const prematricula = toPrematriculaData(data);

  return {
    aluno_data_nascimento: prematricula.aluno.dataNascimento,
    aluno_modalidade: prematricula.aluno.modalidade,
    aluno_nome: prematricula.aluno.nome,
    aluno_observacoes: prematricula.aluno.observacoes,
    aluno_sexo: prematricula.aluno.sexo,
    aluno_unidade_interesse: prematricula.aluno.unidadeInteresse,
    metadata_json: prematricula.metadata ? JSON.stringify(prematricula.metadata) : null,
    origem: prematricula.origem || "pre_matricula",
    pessoa_aluno_id: prematricula.pessoaAlunoId ?? null,
    pessoa_responsavel_id: prematricula.pessoaResponsavelId ?? null,
    responsavel_cpf: prematricula.responsavel.cpf,
    responsavel_email: prematricula.responsavel.email,
    responsavel_nome: prematricula.responsavel.nome,
    responsavel_telefone: prematricula.responsavel.telefone,
    responsavel_whatsapp: prematricula.responsavel.whatsapp,
    status: prematricula.status,
  };
}

/**
 * Parses optional metadata stored as JSON text.
 *
 * @param {unknown} value
 * @returns {Record<string, unknown>|null}
 */
function parseMetadata(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = {
  toPrematriculaDataFromRow,
  toPrematriculaRowValues,
  toPrematriculaData,
  toPrematriculaEntity,
};
