const { query } = require("../../../../config/db.js");
const { ChampionshipRegistration, ChampionshipTeam } = require("../../domain/entities/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const {
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
} = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readObject,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const REGISTRATION_SORT_COLUMNS = Object.freeze({
  createdAt: "registration.created_at",
  status: "registration.status",
  teamName: "team.name",
  updatedAt: "registration.updated_at",
});

const AVAILABLE_TEAM_SORT_COLUMNS = Object.freeze({
  category: "team.category",
  modality: "team.modality",
  name: "team.name",
  status: "team.status",
});

class MySqlChampionshipRegistrationRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
  }

  async ensureSchema() {
    await this.ensureTeamSchema();
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        team_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        observations TEXT NULL,
        metadata_json LONGTEXT NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        confirmed_at DATETIME NULL,
        refused_at DATETIME NULL,
        cancelled_at DATETIME NULL,
        deleted_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_inscricoes_camp (championship_id),
        INDEX idx_j12_campeonato_inscricoes_team (team_id),
        INDEX idx_j12_campeonato_inscricoes_status (status),
        INDEX idx_j12_campeonato_inscricoes_deleted (deleted_at),
        INDEX idx_j12_campeonato_inscricoes_lookup (championship_id, team_id, deleted_at)
      )
    `);
  }

  async ensureTeamSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_TEAM_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        name_key VARCHAR(191) NULL,
        acronym VARCHAR(32) NULL,
        category VARCHAR(120) NOT NULL,
        modality VARCHAR(120) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(80) NULL,
        responsible VARCHAR(191) NULL,
        coach VARCHAR(191) NULL,
        assistant_coach VARCHAR(191) NULL,
        technical_commission_json LONGTEXT NULL,
        primary_uniform VARCHAR(191) NULL,
        secondary_uniform VARCHAR(191) NULL,
        primary_color VARCHAR(32) NULL,
        secondary_color VARCHAR(32) NULL,
        observations TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        shield_json LONGTEXT NULL,
        metadata_json LONGTEXT NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        activated_at DATETIME NULL,
        inactivated_at DATETIME NULL,
        disqualified_at DATETIME NULL,
        deleted_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_equipes_status (status),
        INDEX idx_j12_campeonato_equipes_categoria (category),
        INDEX idx_j12_campeonato_equipes_modalidade (modality),
        INDEX idx_j12_campeonato_equipes_deleted (deleted_at)
      )
    `);
  }

  async create(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} (
          id,
          championship_id,
          team_id,
          status,
          observations,
          metadata_json,
          created_by,
          updated_by,
          confirmed_at,
          refused_at,
          cancelled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.championshipId,
        values.teamId,
        values.status,
        values.observations,
        JSON.stringify(values.metadata || {}),
        values.createdBy,
        values.updatedBy,
        values.status === RegistrationStatus.CONFIRMED ? new Date() : null,
        values.status === RegistrationStatus.REFUSED ? new Date() : null,
        values.status === RegistrationStatus.CANCELLED ? new Date() : null,
      ],
    );

    return this.findById(values.id);
  }

  async update(registrationId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(registrationId, "registrationId", 64);
    const assignments = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(input, "status")) {
      assignments.push("status = ?");
      params.push(requiredText(input.status, "status", 32));
      assignments.push(
        "confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, CURRENT_TIMESTAMP) ELSE confirmed_at END",
      );
      params.push(input.status);
      assignments.push(
        "refused_at = CASE WHEN ? = 'REFUSED' THEN COALESCE(refused_at, CURRENT_TIMESTAMP) ELSE refused_at END",
      );
      params.push(input.status);
      assignments.push(
        "cancelled_at = CASE WHEN ? = 'CANCELLED' THEN COALESCE(cancelled_at, CURRENT_TIMESTAMP) ELSE cancelled_at END",
      );
      params.push(input.status);
    }

    if (Object.prototype.hasOwnProperty.call(input, "observations")) {
      assignments.push("observations = ?");
      params.push(nullableText(input.observations, 2000));
    }

    if (Object.prototype.hasOwnProperty.call(input, "metadata")) {
      assignments.push("metadata_json = ?");
      params.push(JSON.stringify(readObject(input.metadata)));
    }

    if (assignments.length === 0) {
      return this.findById(id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191));
    params.push(id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      params,
    );

    return this.findById(id);
  }

  async findById(registrationId) {
    await this.ensureSchema();
    const id = requiredText(registrationId, "registrationId", 64);
    const rows = await this.query(
      `
        ${baseRegistrationSelect()}
        WHERE registration.id = ?
          AND registration.deleted_at IS NULL
        LIMIT 1
      `,
      [id],
    );

    return mapRegistrationRow(readFirstRow(rows));
  }

  async findByChampionshipAndTeam(championshipId, teamId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseRegistrationSelect()}
        WHERE registration.championship_id = ?
          AND registration.team_id = ?
          AND registration.deleted_at IS NULL
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(teamId, "teamId", 64)],
    );

    return mapRegistrationRow(readFirstRow(rows));
  }

  async findAll(filters = {}) {
    await this.ensureSchema();
    const params = [];
    const where = ["registration.deleted_at IS NULL"];

    if (filters.championshipId) {
      where.push("registration.championship_id = ?");
      params.push(requiredText(filters.championshipId, "championshipId", 64));
    }

    if (filters.teamId) {
      where.push("registration.team_id = ?");
      params.push(requiredText(filters.teamId, "teamId", 64));
    }

    if (filters.status) {
      where.push("registration.status = ?");
      params.push(requiredText(filters.status, "status", 32));
    }

    if (filters.search) {
      where.push(
        "(LOWER(team.name) LIKE ? OR LOWER(championship.name) LIKE ? OR LOWER(registration.observations) LIKE ?)",
      );
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search, search);
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} registration
        LEFT JOIN j12_campeonatos championship ON championship.id = registration.championship_id
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} team ON team.id = registration.team_id
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn =
      REGISTRATION_SORT_COLUMNS[filters.sortBy] || REGISTRATION_SORT_COLUMNS.createdAt;
    const orderDirection = filters.sortDirection === "ASC" ? "ASC" : "DESC";

    const rows = await this.query(
      `
        ${baseRegistrationSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, registration.created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: readRows(rows).map(mapRegistrationRow).filter(Boolean),
      total,
    };
  }

  async countActiveByChampionship(championshipId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME}
        WHERE championship_id = ?
          AND status IN ('PENDING', 'CONFIRMED')
          AND deleted_at IS NULL
      `,
      [requiredText(championshipId, "championshipId", 64)],
    );

    return Number(readFirstRow(rows)?.total || 0);
  }

  async findTeamById(teamId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT *
        FROM ${CHAMPIONSHIP_TEAM_TABLE_NAME}
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [requiredText(teamId, "teamId", 64)],
    );

    return mapTeamRow(readFirstRow(rows));
  }

  async findAvailableTeams(filters = {}) {
    await this.ensureSchema();
    const params = [
      requiredText(filters.championshipId, "championshipId", 64),
      requiredText(filters.category, "category", 120),
      requiredText(filters.modality, "modality", 120),
    ];
    const where = [
      "team.deleted_at IS NULL",
      "(team.status IS NULL OR team.status = 'ACTIVE')",
      "team.category = ?",
      "team.modality = ?",
      "registration.id IS NULL",
    ];

    if (filters.search) {
      where.push("(LOWER(team.name) LIKE ? OR LOWER(team.acronym) LIKE ?)");
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search);
    }

    const fromClause = `
      FROM ${CHAMPIONSHIP_TEAM_TABLE_NAME} team
      LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} registration
        ON registration.team_id = team.id
        AND registration.championship_id = ?
        AND registration.deleted_at IS NULL
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
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn =
      AVAILABLE_TEAM_SORT_COLUMNS[filters.sortBy] || AVAILABLE_TEAM_SORT_COLUMNS.name;
    const orderDirection = filters.sortDirection === "DESC" ? "DESC" : "ASC";

    const rows = await this.query(
      `
        SELECT team.*
        ${fromClause}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, team.name ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: readRows(rows).map(mapTeamRow).filter(Boolean),
      total,
    };
  }
}

function normalizeCreateInput(input = {}) {
  return {
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    id: nullableText(input.id, 64) || createId("insc"),
    metadata: readObject(input.metadata),
    observations: nullableText(input.observations, 2000),
    status: requiredText(input.status || RegistrationStatus.PENDING, "status", 32),
    teamId: requiredText(input.teamId, "teamId", 64),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function baseRegistrationSelect() {
  return `
    SELECT
      registration.*,
      championship.name AS championship_name,
      championship.category AS championship_category,
      championship.modality AS championship_modality,
      team.name AS team_name,
      team.acronym AS team_acronym,
      team.category AS team_category,
      team.modality AS team_modality
    FROM ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} registration
    LEFT JOIN j12_campeonatos championship ON championship.id = registration.championship_id
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} team ON team.id = registration.team_id
  `;
}

function mapRegistrationRow(row) {
  if (!row) return null;

  return ChampionshipRegistration.fromPersistence({
    cancelled_at: row.cancelled_at,
    category: text(row.team_category || row.championship_category, 120),
    championship_id: row.championship_id,
    championship_name: row.championship_name,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    created_by: row.created_by,
    deleted_at: row.deleted_at,
    id: row.id,
    metadata: readObject(row.metadata_json),
    modality: text(row.team_modality || row.championship_modality, 120),
    observations: row.observations,
    refused_at: row.refused_at,
    status: text(row.status, 32),
    team_acronym: row.team_acronym,
    team_id: row.team_id,
    team_name: row.team_name,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function mapTeamRow(row) {
  if (!row) return null;

  return ChampionshipTeam.fromPersistence({
    acronym: row.acronym,
    activated_at: row.activated_at,
    assistant_coach: row.assistant_coach,
    category: text(row.category, 120),
    city: row.city,
    coach: row.coach,
    created_at: row.created_at,
    created_by: row.created_by,
    deleted_at: row.deleted_at,
    disqualified_at: row.disqualified_at,
    id: row.id,
    inactivated_at: row.inactivated_at,
    metadata: readObject(row.metadata_json),
    modality: row.modality,
    name: row.name,
    name_key: row.name_key,
    observations: row.observations,
    primary_color: row.primary_color,
    primary_uniform: row.primary_uniform,
    responsible: row.responsible,
    secondary_color: row.secondary_color,
    secondary_uniform: row.secondary_uniform,
    shield: readObject(row.shield_json),
    state: row.state,
    status: row.status,
    technical_commission: readArray(row.technical_commission_json),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
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

function normalizeLimitValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.trunc(parsed), 100);
}

function normalizePageValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

module.exports = {
  MySqlChampionshipRegistrationRepository,
};
