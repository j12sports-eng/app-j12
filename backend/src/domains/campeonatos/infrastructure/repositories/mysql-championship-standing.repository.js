const { query, transaction } = require("../../../../config/db.js");
const { ChampionshipStanding } = require("../../domain/entities/index.js");
const {
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_STANDING_TABLE_NAME,
} = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
} = require("../../shared/utils/index.js");
const { MySqlChampionshipGroupRepository } = require("./mysql-championship-group.repository.js");

const STANDING_SORT_COLUMNS = Object.freeze({
  draws: "standing.draws",
  goalDifference: "standing.goal_difference",
  goalsAgainst: "standing.goals_against",
  goalsFor: "standing.goals_for",
  losses: "standing.losses",
  played: "standing.played",
  points: "standing.points",
  teamName: "standing.team_name",
  wins: "standing.wins",
});

class MySqlChampionshipStandingRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.transaction = options.transactionRunner || options.transaction || transaction;
    this.groupSchemaRepository =
      options.groupSchemaRepository ||
      new MySqlChampionshipGroupRepository({
        queryRunner: this.query,
        transactionRunner: options.transactionRunner || null,
      });
  }

  async ensureSchema() {
    await this.groupSchemaRepository.ensureSchema();
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_STANDING_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        group_id VARCHAR(64) NOT NULL,
        group_name VARCHAR(80) NULL,
        group_display_order INT NOT NULL DEFAULT 0,
        registration_id VARCHAR(64) NOT NULL,
        team_id VARCHAR(64) NULL,
        team_name VARCHAR(191) NULL,
        team_acronym VARCHAR(40) NULL,
        position INT NOT NULL DEFAULT 0,
        group_position INT NOT NULL DEFAULT 0,
        overall_position INT NOT NULL DEFAULT 0,
        played INT NOT NULL DEFAULT 0,
        wins INT NOT NULL DEFAULT 0,
        draws INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        goals_for INT NOT NULL DEFAULT 0,
        goals_against INT NOT NULL DEFAULT 0,
        goal_difference INT NOT NULL DEFAULT 0,
        points INT NOT NULL DEFAULT 0,
        tie_breakers_json LONGTEXT NULL,
        calculated_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_class_camp (championship_id),
        INDEX idx_j12_campeonato_class_grupo (championship_id, group_id),
        INDEX idx_j12_campeonato_class_posicao (championship_id, group_id, position),
        UNIQUE KEY uniq_j12_campeonato_class_insc (
          championship_id,
          group_id,
          registration_id
        )
      )
    `);
  }

  async replaceByChampionship(championshipId, standings = []) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const work = async (executor) => {
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_STANDING_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );

      for (const standing of standings) {
        const values = normalizeStandingInput({ ...standing, championshipId: campId });
        await runQuery(
          executor,
          `
            INSERT INTO ${CHAMPIONSHIP_STANDING_TABLE_NAME} (
              id,
              championship_id,
              group_id,
              group_name,
              group_display_order,
              registration_id,
              team_id,
              team_name,
              team_acronym,
              position,
              group_position,
              overall_position,
              played,
              wins,
              draws,
              losses,
              goals_for,
              goals_against,
              goal_difference,
              points,
              tie_breakers_json,
              calculated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            values.id,
            values.championshipId,
            values.groupId,
            values.groupName,
            values.groupDisplayOrder,
            values.registrationId,
            values.teamId,
            values.teamName,
            values.teamAcronym,
            values.position,
            values.groupPosition,
            values.overallPosition,
            values.played,
            values.wins,
            values.draws,
            values.losses,
            values.goalsFor,
            values.goalsAgainst,
            values.goalDifference,
            values.points,
            JSON.stringify(values.tieBreakers),
            values.calculatedAt,
          ],
        );
      }
    };

    if (typeof this.transaction === "function") {
      await this.transaction(work);
    } else {
      await work(this.query);
    }

    return this.findByChampionship({ championshipId: campId, limit: 500, page: 1 });
  }

  async findByChampionship(filters = {}) {
    await this.ensureSchema();
    const params = [requiredText(filters.championshipId, "championshipId", 64)];
    const where = ["standing.championship_id = ?"];

    if (filters.groupId) {
      where.push("standing.group_id = ?");
      params.push(requiredText(filters.groupId, "groupId", 64));
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_STANDING_TABLE_NAME} standing
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const hasExplicitSort = Boolean(filters.sortBy);
    const orderColumn = STANDING_SORT_COLUMNS[filters.sortBy] || "standing.overall_position";
    const orderDirection = hasExplicitSort
      ? filters.sortDirection === "ASC"
        ? "ASC"
        : "DESC"
      : "ASC";
    const rows = await this.query(
      `
        ${baseStandingSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection},
          standing.overall_position ASC,
          standing.group_display_order ASC,
          standing.position ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: readRows(rows).map(mapStandingRow).filter(Boolean),
      total,
    };
  }

  async findByGroup(championshipId, groupId, filters = {}) {
    return this.findByChampionship({
      ...filters,
      championshipId,
      groupId,
      sortBy: filters.sortBy || "points",
      sortDirection: filters.sortDirection || "DESC",
    });
  }

  async deleteByChampionship(championshipId) {
    await this.ensureSchema();
    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_STANDING_TABLE_NAME}
        WHERE championship_id = ?
      `,
      [requiredText(championshipId, "championshipId", 64)],
    );
  }
}

function baseStandingSelect() {
  return `
    SELECT
      standing.*,
      group_item.display_order AS current_group_display_order
    FROM ${CHAMPIONSHIP_STANDING_TABLE_NAME} standing
    LEFT JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
      ON group_item.id = standing.group_id
  `;
}

function mapStandingRow(row) {
  if (!row) return null;

  return ChampionshipStanding.fromPersistence({
    calculated_at: row.calculated_at,
    championship_id: row.championship_id,
    draws: row.draws,
    goal_difference: row.goal_difference,
    goals_against: row.goals_against,
    goals_for: row.goals_for,
    group_display_order: row.current_group_display_order ?? row.group_display_order,
    group_id: row.group_id,
    group_name: row.group_name,
    group_position: row.group_position,
    id: row.id,
    losses: row.losses,
    overall_position: row.overall_position,
    played: row.played,
    points: row.points,
    position: row.position,
    registration_id: row.registration_id,
    team_acronym: row.team_acronym,
    team_id: row.team_id,
    team_name: row.team_name,
    tie_breakers_json: row.tie_breakers_json,
    updated_at: row.updated_at,
    wins: row.wins,
  });
}

function normalizeStandingInput(input = {}) {
  return {
    calculatedAt: input.calculatedAt || toSqlDateTime(new Date()),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    draws: normalizeNumber(input.draws),
    goalDifference: normalizeNumber(input.goalDifference),
    goalsAgainst: normalizeNumber(input.goalsAgainst),
    goalsFor: normalizeNumber(input.goalsFor),
    groupDisplayOrder: normalizeNumber(input.groupDisplayOrder),
    groupId: requiredText(input.groupId, "groupId", 64),
    groupName: nullableText(input.groupName, 80),
    groupPosition: normalizeNumber(input.groupPosition || input.position),
    id: nullableText(input.id, 64) || createId("classificacao"),
    losses: normalizeNumber(input.losses),
    overallPosition: normalizeNumber(input.overallPosition || input.position),
    played: normalizeNumber(input.played),
    points: normalizeNumber(input.points),
    position: normalizeNumber(input.position),
    registrationId: requiredText(input.registrationId, "registrationId", 64),
    teamAcronym: nullableText(input.teamAcronym, 40),
    teamId: nullableText(input.teamId, 64),
    teamName: nullableText(input.teamName, 191),
    tieBreakers: Array.isArray(input.tieBreakers) ? input.tieBreakers : [],
    wins: normalizeNumber(input.wins),
  };
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeLimitValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.trunc(parsed), 500);
}

function normalizePageValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function toSqlDateTime(value) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

async function runQuery(executor, sql, params) {
  if (typeof executor === "function") {
    return executor(sql, params);
  }

  if (executor && typeof executor.execute === "function") {
    const [rows] = await executor.execute(sql, params);
    return rows;
  }

  if (executor && typeof executor.query === "function") {
    const [rows] = await executor.query(sql, params);
    return rows;
  }

  throw new Error("Executor SQL invalido para transacao de classificacao.");
}

module.exports = {
  MySqlChampionshipStandingRepository,
};
