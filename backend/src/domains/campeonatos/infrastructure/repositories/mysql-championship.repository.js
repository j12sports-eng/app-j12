const { query } = require("../../../../config/db.js");
const { Championship } = require("../../domain/entities/index.js");
const { ChampionshipStatus } = require("../../shared/enums/index.js");
const { CHAMPIONSHIP_TABLE_NAME } = require("../../shared/constants/index.js");
const {
  createId,
  normalizeChampionshipStatus,
  normalizeLimit,
  nullableText,
  readFirstRow,
  readObject,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const CHAMPIONSHIP_COLUMNS =
  "id, name, category, modality, start_date, end_date, status, description, metadata_json, created_by, updated_by, published_at, archived_at, deleted_at, created_at, updated_at";

class MySqlChampionshipRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
  }

  async ensureSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        category VARCHAR(120) NOT NULL,
        modality VARCHAR(120) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        description TEXT NULL,
        metadata_json LONGTEXT NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        published_at DATETIME NULL,
        archived_at DATETIME NULL,
        deleted_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonatos_status (status),
        INDEX idx_j12_campeonatos_periodo (start_date, end_date),
        INDEX idx_j12_campeonatos_categoria (category),
        INDEX idx_j12_campeonatos_modalidade (modality),
        INDEX idx_j12_campeonatos_deleted_at (deleted_at)
      )
    `);
  }

  async create(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_TABLE_NAME} (
          id,
          name,
          category,
          modality,
          start_date,
          end_date,
          status,
          description,
          metadata_json,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.name,
        values.category,
        values.modality,
        values.startDate,
        values.endDate,
        values.status,
        values.description,
        JSON.stringify(values.metadata || {}),
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findById(values.id);
  }

  async update(championshipId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(championshipId, "championshipId", 64);
    const values = normalizeUpdateInput(input);
    const assignments = [];
    const params = [];

    for (const [column, value] of Object.entries(values.columns)) {
      assignments.push(`${column} = ?`);
      params.push(value);
    }

    if (assignments.length === 0) {
      return this.findById(id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(values.updatedBy);
    params.push(id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      params,
    );

    return this.findById(id);
  }

  async remove(championshipId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(championshipId, "championshipId", 64);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_TABLE_NAME}
        SET
          status = ?,
          deleted_at = CURRENT_TIMESTAMP,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [ChampionshipStatus.REMOVED, nullableText(input.updatedBy, 191), id],
    );

    return this.findById(id, { includeRemoved: true });
  }

  async findById(championshipId, options = {}) {
    await this.ensureSchema();
    const id = requiredText(championshipId, "championshipId", 64);
    const rows = await this.query(
      `
        SELECT ${CHAMPIONSHIP_COLUMNS}
        FROM ${CHAMPIONSHIP_TABLE_NAME}
        WHERE id = ?
          ${options.includeRemoved ? "" : "AND deleted_at IS NULL"}
        LIMIT 1
      `,
      [id],
    );

    return mapChampionshipRow(readFirstRow(rows));
  }

  async findAll(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = ["deleted_at IS NULL"];

    if (filters.status) {
      where.push("status = ?");
      params.push(normalizeChampionshipStatus(filters.status));
    }

    if (filters.search) {
      where.push("(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(modality) LIKE ?)");
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search, search);
    }

    const limit = normalizeLimit(filters.limit, 100);

    const rows = await this.query(
      `
        SELECT ${CHAMPIONSHIP_COLUMNS}
        FROM ${CHAMPIONSHIP_TABLE_NAME}
        WHERE ${where.join(" AND ")}
        ORDER BY start_date DESC, created_at DESC
        LIMIT ${limit}
      `,
      params,
    );

    return readRows(rows).map(mapChampionshipRow).filter(Boolean);
  }

  async publish(championshipId, input = {}) {
    return this.updateStatus(championshipId, ChampionshipStatus.PUBLISHED, {
      timestampColumn: "published_at",
      updatedBy: input.updatedBy,
    });
  }

  async archive(championshipId, input = {}) {
    return this.updateStatus(championshipId, ChampionshipStatus.ARCHIVED, {
      timestampColumn: "archived_at",
      updatedBy: input.updatedBy,
    });
  }

  async updateStatus(championshipId, status, options = {}) {
    await this.ensureSchema();
    const id = requiredText(championshipId, "championshipId", 64);
    const timestampColumn = options.timestampColumn;
    const timestampAssignment = timestampColumn ? `, ${timestampColumn} = CURRENT_TIMESTAMP` : "";

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_TABLE_NAME}
        SET
          status = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
          ${timestampAssignment}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [normalizeChampionshipStatus(status), nullableText(options.updatedBy, 191), id],
    );

    return this.findById(id);
  }
}

function normalizeCreateInput(input = {}) {
  return {
    category: requiredText(input.category, "category", 120),
    createdBy: nullableText(input.createdBy, 191),
    description: nullableText(input.description, 2000),
    endDate: requiredText(input.endDate, "endDate", 10),
    id: nullableText(input.id, 64) || createId("camp"),
    metadata: readObject(input.metadata),
    modality: requiredText(input.modality, "modality", 120),
    name: requiredText(input.name, "name", 191),
    startDate: requiredText(input.startDate, "startDate", 10),
    status: normalizeChampionshipStatus(input.status),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function normalizeUpdateInput(input = {}) {
  const columns = {};

  if (Object.prototype.hasOwnProperty.call(input, "name")) {
    columns.name = requiredText(input.name, "name", 191);
  }

  if (Object.prototype.hasOwnProperty.call(input, "category")) {
    columns.category = requiredText(input.category, "category", 120);
  }

  if (Object.prototype.hasOwnProperty.call(input, "modality")) {
    columns.modality = requiredText(input.modality, "modality", 120);
  }

  if (Object.prototype.hasOwnProperty.call(input, "startDate")) {
    columns.start_date = requiredText(input.startDate, "startDate", 10);
  }

  if (Object.prototype.hasOwnProperty.call(input, "endDate")) {
    columns.end_date = requiredText(input.endDate, "endDate", 10);
  }

  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    columns.status = normalizeChampionshipStatus(input.status);
  }

  if (Object.prototype.hasOwnProperty.call(input, "description")) {
    columns.description = nullableText(input.description, 2000);
  }

  if (Object.prototype.hasOwnProperty.call(input, "metadata")) {
    columns.metadata_json = JSON.stringify(readObject(input.metadata));
  }

  return {
    columns,
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function mapChampionshipRow(row) {
  if (!row) return null;

  return Championship.fromPersistence({
    archived_at: row.archived_at,
    category: text(row.category, 120),
    created_at: row.created_at,
    created_by: row.created_by,
    deleted_at: row.deleted_at,
    description: row.description,
    end_date: toDateValue(row.end_date),
    id: row.id,
    metadata: readObject(row.metadata_json),
    modality: text(row.modality, 120),
    name: text(row.name, 191),
    published_at: row.published_at,
    start_date: toDateValue(row.start_date),
    status: normalizeChampionshipStatus(row.status),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

module.exports = {
  MySqlChampionshipRepository,
};
