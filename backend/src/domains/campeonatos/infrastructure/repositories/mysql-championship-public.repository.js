const { query } = require("../../../../config/db.js");
const { MySqlChampionshipGroupRepository } = require("./mysql-championship-group.repository.js");
const {
  MySqlChampionshipRegistrationRepository,
} = require("./mysql-championship-registration.repository.js");
const { MySqlChampionshipRepository } = require("./mysql-championship.repository.js");
const {
  CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
} = require("../../shared/constants/index.js");
const { ChampionshipStatus, RegistrationStatus } = require("../../shared/enums/index.js");
const {
  readFirstRow,
  readObject,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const PUBLIC_CHAMPIONSHIP_SORT_COLUMNS = Object.freeze({
  category: "category",
  modality: "modality",
  name: "name",
  publishedAt: "published_at",
  startDate: "start_date",
});

class MySqlChampionshipPublicRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.championshipSchemaRepository =
      options.championshipSchemaRepository ||
      new MySqlChampionshipRepository({
        queryRunner: this.query,
      });
    this.registrationSchemaRepository =
      options.registrationSchemaRepository ||
      new MySqlChampionshipRegistrationRepository({
        queryRunner: this.query,
      });
    this.groupSchemaRepository =
      options.groupSchemaRepository ||
      new MySqlChampionshipGroupRepository({
        queryRunner: this.query,
        transactionRunner: options.transactionRunner || null,
      });
  }

  async ensureSchema() {
    await this.championshipSchemaRepository.ensureSchema();
    await this.registrationSchemaRepository.ensureSchema();
    await this.groupSchemaRepository.ensureSchema();
  }

  async findPublishedAll(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = ["deleted_at IS NULL", "status = ?"];
    params.push(ChampionshipStatus.PUBLISHED);

    if (filters.search) {
      where.push("(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(modality) LIKE ?)");
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search, search);
    }

    if (filters.category) {
      where.push("LOWER(category) = ?");
      params.push(String(filters.category).toLowerCase());
    }

    if (filters.modality) {
      where.push("LOWER(modality) = ?");
      params.push(String(filters.modality).toLowerCase());
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_TABLE_NAME}
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit, 20);
    const page = normalizePageValue(filters.page);
    const offset = (page - 1) * limit;
    const orderColumn =
      PUBLIC_CHAMPIONSHIP_SORT_COLUMNS[filters.sortBy] ||
      PUBLIC_CHAMPIONSHIP_SORT_COLUMNS.publishedAt;
    const orderDirection = filters.sortDirection === "ASC" ? "ASC" : "DESC";
    const rows = await this.query(
      `
        SELECT *
        FROM ${CHAMPIONSHIP_TABLE_NAME}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, start_date DESC, name ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      params,
    );

    return {
      items: readRows(rows).map(mapPublicChampionshipRow).filter(Boolean),
      total,
    };
  }

  async findPublishedById(championshipId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT *
        FROM ${CHAMPIONSHIP_TABLE_NAME}
        WHERE id = ?
          AND status = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64), ChampionshipStatus.PUBLISHED],
    );

    return mapPublicChampionshipRow(readFirstRow(rows));
  }

  async findTeamsByChampionship(filters = {}) {
    await this.ensureSchema();
    const params = [requiredText(filters.championshipId, "championshipId", 64)];
    const where = [
      "championship.id = ?",
      "championship.status = ?",
      "championship.deleted_at IS NULL",
      "registration.deleted_at IS NULL",
      "registration.status = ?",
      "team.deleted_at IS NULL",
    ];
    params.push(ChampionshipStatus.PUBLISHED, RegistrationStatus.CONFIRMED);

    if (filters.search) {
      where.push("(LOWER(team.name) LIKE ? OR LOWER(team.acronym) LIKE ?)");
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search);
    }

    const fromClause = `
      FROM ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} registration
      INNER JOIN ${CHAMPIONSHIP_TABLE_NAME} championship
        ON championship.id = registration.championship_id
      INNER JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} team
        ON team.id = registration.team_id
      LEFT JOIN ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} assignment
        ON assignment.registration_id = registration.id
      LEFT JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
        ON group_item.id = assignment.group_id
    `;
    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        ${fromClause}
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit, 100);
    const page = normalizePageValue(filters.page);
    const offset = (page - 1) * limit;
    const rows = await this.query(
      `
        SELECT
          registration.id AS registration_id,
          registration.championship_id,
          registration.status AS registration_status,
          team.id AS team_id,
          team.name AS team_name,
          team.acronym AS team_acronym,
          team.category,
          team.modality,
          team.city,
          team.state,
          team.coach,
          team.assistant_coach,
          team.technical_commission_json,
          team.primary_uniform,
          team.secondary_uniform,
          team.primary_color,
          team.secondary_color,
          team.shield_json,
          group_item.id AS group_id,
          group_item.name AS group_name,
          assignment.draw_position
        ${fromClause}
        WHERE ${where.join(" AND ")}
        ORDER BY group_item.display_order ASC, assignment.draw_position ASC, team.name ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      params,
    );

    return {
      items: readRows(rows).map(mapPublicTeamRow).filter(Boolean),
      total,
    };
  }
}

function mapPublicChampionshipRow(row) {
  if (!row) return null;

  const metadata = readObject(row.metadata_json);

  return {
    category: text(row.category, 120),
    description: row.description || null,
    endDate: toDateValue(row.end_date),
    id: row.id,
    logo: metadata.logo || null,
    metadata,
    modality: text(row.modality, 120),
    name: text(row.name, 191),
    publishedAt: row.published_at || null,
    startDate: toDateValue(row.start_date),
    status: row.status || ChampionshipStatus.PUBLISHED,
  };
}

function mapPublicTeamRow(row) {
  if (!row) return null;

  return {
    assistantCoach: row.assistant_coach || null,
    category: text(row.category, 120),
    championshipId: row.championship_id,
    city: row.city || null,
    coach: row.coach || null,
    drawPosition: normalizeIntegerOrNull(row.draw_position),
    groupId: row.group_id || null,
    groupName: row.group_name || null,
    logo: readObject(row.shield_json),
    modality: text(row.modality, 120),
    primaryColor: row.primary_color || null,
    primaryUniform: row.primary_uniform || null,
    registrationId: row.registration_id,
    secondaryColor: row.secondary_color || null,
    secondaryUniform: row.secondary_uniform || null,
    state: row.state || null,
    status: row.registration_status,
    teamAcronym: row.team_acronym || null,
    teamId: row.team_id,
    teamName: row.team_name,
    technicalCommission: readArray(row.technical_commission_json),
  };
}

function readArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeIntegerOrNull(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeLimitValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 100);
}

function normalizePageValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

module.exports = {
  MySqlChampionshipPublicRepository,
};
