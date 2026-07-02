const { randomUUID } = require("node:crypto");

const { query } = require("../../../config/db.js");
const {
  toPrematriculaDataFromRow,
  toPrematriculaRowValues,
} = require("./prematricula.mapper.js");
const { PRE_MATRICULA_STATUS_VALUES } = require("./prematricula.types.js");

const TABLE_NAME = "pre_matriculas";

const CREATE_PRE_MATRICULAS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS pre_matriculas (
    id VARCHAR(64) PRIMARY KEY,
    status ENUM('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'CANCELADA') NOT NULL DEFAULT 'PENDENTE',

    aluno_nome VARCHAR(191) NOT NULL,
    aluno_data_nascimento DATE NOT NULL,
    aluno_sexo VARCHAR(30) NULL,
    aluno_unidade_interesse VARCHAR(191) NOT NULL,
    aluno_modalidade VARCHAR(191) NOT NULL,
    aluno_observacoes TEXT NULL,

    responsavel_nome VARCHAR(191) NOT NULL,
    responsavel_cpf VARCHAR(20) NOT NULL,
    responsavel_telefone VARCHAR(50) NOT NULL,
    responsavel_whatsapp VARCHAR(50) NOT NULL,
    responsavel_email VARCHAR(191) NOT NULL,

    pessoa_aluno_id VARCHAR(64) NULL,
    pessoa_responsavel_id VARCHAR(64) NULL,
    origem VARCHAR(50) NOT NULL DEFAULT 'pre_matricula',
    metadata_json LONGTEXT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pre_matriculas_status (status),
    INDEX idx_pre_matriculas_responsavel_cpf (responsavel_cpf),
    INDEX idx_pre_matriculas_created_at (created_at),
    INDEX idx_pre_matriculas_pessoa_aluno (pessoa_aluno_id),
    INDEX idx_pre_matriculas_pessoa_responsavel (pessoa_responsavel_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const UPDATE_COLUMN_MAP = Object.freeze({
  aluno_data_nascimento: "aluno_data_nascimento",
  aluno_modalidade: "aluno_modalidade",
  aluno_nome: "aluno_nome",
  aluno_observacoes: "aluno_observacoes",
  aluno_sexo: "aluno_sexo",
  aluno_unidade_interesse: "aluno_unidade_interesse",
  metadata_json: "metadata_json",
  origem: "origem",
  pessoa_aluno_id: "pessoa_aluno_id",
  pessoa_responsavel_id: "pessoa_responsavel_id",
  responsavel_cpf: "responsavel_cpf",
  responsavel_email: "responsavel_email",
  responsavel_nome: "responsavel_nome",
  responsavel_telefone: "responsavel_telefone",
  responsavel_whatsapp: "responsavel_whatsapp",
  status: "status",
});

/**
 * Repository for the isolated Pre-Matricula domain.
 *
 * The repository uses the existing mysql2 pool wrapper and only touches the new
 * `pre_matriculas` table. It does not read or write any legacy table.
 */
class PrematriculaRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = query } = {}) {
    this.query = queryRunner;
  }

  /**
   * Creates the isolated `pre_matriculas` table when the deployment script has
   * not been executed yet.
   *
   * @returns {Promise<void>}
   */
  async ensureTable() {
    await this.query(CREATE_PRE_MATRICULAS_TABLE_SQL);
  }

  /**
   * Verifies database access without mutating data.
   *
   * @returns {Promise<boolean>}
   */
  async ping() {
    const rows = await this.query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows[0]?.ok === 1;
  }

  /**
   * Creates a pre-registration row.
   *
   * @param {import("./prematricula.types.js").PrematriculaData} data
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData|null>}
   */
  async create(data) {
    const id = data.id || randomUUID();
    const values = toPrematriculaRowValues({ ...data, id });

    await this.query(
      `
        INSERT INTO ${TABLE_NAME} (
          id,
          status,
          aluno_nome,
          aluno_data_nascimento,
          aluno_sexo,
          aluno_unidade_interesse,
          aluno_modalidade,
          aluno_observacoes,
          responsavel_nome,
          responsavel_cpf,
          responsavel_telefone,
          responsavel_whatsapp,
          responsavel_email,
          pessoa_aluno_id,
          pessoa_responsavel_id,
          origem,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        values.status,
        values.aluno_nome,
        values.aluno_data_nascimento,
        values.aluno_sexo,
        values.aluno_unidade_interesse,
        values.aluno_modalidade,
        values.aluno_observacoes,
        values.responsavel_nome,
        values.responsavel_cpf,
        values.responsavel_telefone,
        values.responsavel_whatsapp,
        values.responsavel_email,
        values.pessoa_aluno_id,
        values.pessoa_responsavel_id,
        values.origem,
        values.metadata_json,
      ],
    );

    return this.findById(id);
  }

  /**
   * Finds one pre-registration by id.
   *
   * @param {string} id
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData|null>}
   */
  async findById(id) {
    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    return toPrematriculaDataFromRow(Array.isArray(rows) ? rows[0] : null);
  }

  /**
   * Lists pre-registrations with optional filters.
   *
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData[]>}
   */
  async list(filters = {}) {
    const params = [];
    const where = [];
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    if (filters.status) {
      if (!PRE_MATRICULA_STATUS_VALUES.includes(filters.status)) {
        return [];
      }

      where.push("status = ?");
      params.push(filters.status);
    }

    params.push(limit, offset);

    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        OFFSET ?
      `,
      params,
    );

    return Array.isArray(rows) ? rows.map(toPrematriculaDataFromRow).filter(Boolean) : [];
  }

  /**
   * Updates a pre-registration row with full domain data.
   *
   * @param {string} id
   * @param {import("./prematricula.types.js").PrematriculaData} data
   * @returns {Promise<import("./prematricula.types.js").PrematriculaData|null>}
   */
  async update(id, data) {
    const values = toPrematriculaRowValues(data);
    const assignments = [];
    const params = [];

    for (const [key, column] of Object.entries(UPDATE_COLUMN_MAP)) {
      assignments.push(`${column} = ?`);
      params.push(values[key]);
    }

    params.push(id);

    const result = await this.query(
      `
        UPDATE ${TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      params,
    );

    if (!result || result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Deletes a pre-registration row.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    return Boolean(result && result.affectedRows > 0);
  }
}

/**
 * Normalizes the list limit to avoid unbounded queries.
 *
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.trunc(parsed), 200);
}

/**
 * Normalizes the list offset.
 *
 * @param {unknown} value
 * @returns {number}
 */
function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

module.exports = {
  CREATE_PRE_MATRICULAS_TABLE_SQL,
  PRE_MATRICULAS_TABLE_NAME: TABLE_NAME,
  PrematriculaRepository,
};
