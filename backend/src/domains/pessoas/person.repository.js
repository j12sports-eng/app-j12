const { randomUUID } = require("node:crypto");

const { toPersonDataFromRow, toPersonRowValues } = require("./person.mapper.js");

const TABLE_NAME = "people";

const CREATE_PEOPLE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS people (
    id VARCHAR(64) PRIMARY KEY,
    nome VARCHAR(191) NOT NULL,
    cpf VARCHAR(20) NULL,
    rg VARCHAR(30) NULL,
    sexo VARCHAR(30) NULL,
    data_nascimento DATE NULL,
    email VARCHAR(191) NULL,
    telefone VARCHAR(50) NULL,
    celular VARCHAR(50) NULL,
    cep VARCHAR(20) NULL,
    logradouro VARCHAR(191) NULL,
    numero VARCHAR(30) NULL,
    bairro VARCHAR(191) NULL,
    cidade VARCHAR(191) NULL,
    estado VARCHAR(50) NULL,
    complemento VARCHAR(191) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_people_nome (nome),
    INDEX idx_people_cpf (cpf),
    INDEX idx_people_email (email),
    INDEX idx_people_ativo (ativo)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const UPDATE_COLUMN_MAP = Object.freeze({
  ativo: "ativo",
  bairro: "bairro",
  celular: "celular",
  cep: "cep",
  cidade: "cidade",
  complemento: "complemento",
  cpf: "cpf",
  data_nascimento: "data_nascimento",
  email: "email",
  estado: "estado",
  logradouro: "logradouro",
  nome: "nome",
  numero: "numero",
  rg: "rg",
  sexo: "sexo",
  telefone: "telefone",
});

/**
 * Repository for the isolated Pessoa persistence layer.
 *
 * It uses the existing mysql2 query wrapper only when instantiated and only
 * touches the independent `people` table. No current module is queried here.
 */
class PersonRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * Creates the independent `people` table when it does not exist.
   *
   * @returns {Promise<void>}
   */
  async ensureTable() {
    await this.query(CREATE_PEOPLE_TABLE_SQL);
  }

  /**
   * Verifies database access without changing data.
   *
   * @returns {Promise<boolean>}
   */
  async ping() {
    const rows = await this.query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows[0]?.ok === 1;
  }

  /**
   * Creates a Pessoa row.
   *
   * @param {import("./person.mapper.js").PersonPersistenceData & Partial<import("./person.types.js").PersonData>} data
   * @returns {Promise<ReturnType<typeof toPersonDataFromRow>>}
   */
  async create(data) {
    const id = data.id || randomUUID();
    const values = toPersonRowValues({ ...data, id });

    await this.query(
      `
        INSERT INTO ${TABLE_NAME} (
          id,
          nome,
          cpf,
          rg,
          sexo,
          data_nascimento,
          email,
          telefone,
          celular,
          cep,
          logradouro,
          numero,
          bairro,
          cidade,
          estado,
          complemento,
          ativo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        values.nome,
        values.cpf,
        values.rg,
        values.sexo,
        values.data_nascimento,
        values.email,
        values.telefone,
        values.celular,
        values.cep,
        values.logradouro,
        values.numero,
        values.bairro,
        values.cidade,
        values.estado,
        values.complemento,
        values.ativo,
      ],
    );

    return this.findById(id);
  }

  /**
   * Finds a Pessoa by id.
   *
   * @param {string} id
   * @returns {Promise<ReturnType<typeof toPersonDataFromRow>>}
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

    return toPersonDataFromRow(Array.isArray(rows) ? rows[0] : null);
  }

  /**
   * Finds a Pessoa by CPF.
   *
   * @param {string} cpf
   * @returns {Promise<ReturnType<typeof toPersonDataFromRow>>}
   */
  async findByCpf(cpf) {
    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE cpf = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [cpf],
    );

    return toPersonDataFromRow(Array.isArray(rows) ? rows[0] : null);
  }

  /**
   * Lists Pessoas with optional filters.
   *
   * @param {Object} [filters]
   * @param {boolean|number|string} [filters.ativo]
   * @param {string} [filters.cpf]
   * @param {string} [filters.email]
   * @param {string} [filters.search]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @returns {Promise<Array<NonNullable<ReturnType<typeof toPersonDataFromRow>>>>}
   */
  async list(filters = {}) {
    const params = [];
    const where = [];
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    if (filters.ativo !== undefined) {
      where.push("ativo = ?");
      params.push(normalizeActiveFilter(filters.ativo));
    }

    if (filters.cpf) {
      where.push("cpf = ?");
      params.push(String(filters.cpf).trim());
    }

    if (filters.email) {
      where.push("email = ?");
      params.push(String(filters.email).trim());
    }

    if (filters.search) {
      where.push("(nome LIKE ? OR cpf LIKE ? OR email LIKE ?)");
      const term = `%${String(filters.search).trim()}%`;
      params.push(term, term, term);
    }

    params.push(limit, offset);

    const rows = await this.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC, nome ASC
        LIMIT ?
        OFFSET ?
      `,
      params,
    );

    return Array.isArray(rows) ? rows.map(toPersonDataFromRow).filter(Boolean) : [];
  }

  /**
   * Updates a Pessoa row with full mapped data.
   *
   * @param {string} id
   * @param {import("./person.mapper.js").PersonPersistenceData & Partial<import("./person.types.js").PersonData>} data
   * @returns {Promise<ReturnType<typeof toPersonDataFromRow>>}
   */
  async update(id, data) {
    const values = toPersonRowValues({ ...data, id });
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
   * Deletes a Pessoa row.
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
 * Loads the current mysql2 query wrapper lazily to avoid side effects when the
 * domain index is imported only for architecture discovery.
 *
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../config/db.js").query;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeActiveFilter(value) {
  if (value === false || value === 0 || value === "0" || value === "false") return 0;
  return 1;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.trunc(parsed), 200);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

module.exports = {
  CREATE_PEOPLE_TABLE_SQL,
  PEOPLE_TABLE_NAME: TABLE_NAME,
  PersonRepository,
};
