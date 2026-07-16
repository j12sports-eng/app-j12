const { query, transaction } = require("../../../../config/db.js");
const {
  ChampionshipPlayerStatistics,
  ChampionshipStatistics,
  ChampionshipTeamStatistics,
} = require("../../domain/entities/index.js");
const {
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME,
  CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME,
  CHAMPIONSHIP_MATCH_TABLE_NAME,
  CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_ROUND_TABLE_NAME,
  CHAMPIONSHIP_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
} = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
} = require("../../shared/utils/index.js");
const {
  MySqlChampionshipMatchReportRepository,
} = require("./mysql-championship-match-report.repository.js");

const STATISTICS_COLUMNS =
  "id, championship_id, matches_played, finished_matches, goals_scored, goals_average, yellow_cards, red_cards, walkovers, calculated_at, updated_at";
const TEAM_STATISTICS_COLUMNS =
  "id, championship_id, registration_id, team_id, team_name, team_acronym, matches_played, wins, draws, losses, goals_for, goals_against, goal_difference, points, performance, result_streak_json, yellow_cards, red_cards, walkovers, calculated_at, updated_at";
const PLAYER_STATISTICS_COLUMNS =
  "id, championship_id, registration_id, team_id, team_name, team_acronym, player_id, player_name, shirt_number, matches_played, goals, yellow_cards, red_cards, calculated_at, updated_at";

class MySqlChampionshipStatisticsRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.transaction = options.transactionRunner || options.transaction || transaction;
    this.matchReportSchemaRepository =
      options.matchReportSchemaRepository ||
      new MySqlChampionshipMatchReportRepository({
        queryRunner: this.query,
        transactionRunner: options.transactionRunner || null,
      });
  }

  async ensureSchema() {
    await this.matchReportSchemaRepository.ensureSchema();
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_STATISTICS_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        matches_played INT NOT NULL DEFAULT 0,
        finished_matches INT NOT NULL DEFAULT 0,
        goals_scored INT NOT NULL DEFAULT 0,
        goals_average DECIMAL(10,2) NOT NULL DEFAULT 0,
        yellow_cards INT NOT NULL DEFAULT 0,
        red_cards INT NOT NULL DEFAULT 0,
        walkovers INT NOT NULL DEFAULT 0,
        calculated_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_j12_campeonato_estatisticas_camp (championship_id),
        INDEX idx_j12_campeonato_estatisticas_calculo (championship_id, calculated_at)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        registration_id VARCHAR(64) NOT NULL,
        team_id VARCHAR(64) NULL,
        team_name VARCHAR(191) NULL,
        team_acronym VARCHAR(40) NULL,
        matches_played INT NOT NULL DEFAULT 0,
        wins INT NOT NULL DEFAULT 0,
        draws INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        goals_for INT NOT NULL DEFAULT 0,
        goals_against INT NOT NULL DEFAULT 0,
        goal_difference INT NOT NULL DEFAULT 0,
        points INT NOT NULL DEFAULT 0,
        performance DECIMAL(7,2) NOT NULL DEFAULT 0,
        result_streak_json TEXT NULL,
        yellow_cards INT NOT NULL DEFAULT 0,
        red_cards INT NOT NULL DEFAULT 0,
        walkovers INT NOT NULL DEFAULT 0,
        calculated_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_estat_equipes_camp (championship_id),
        INDEX idx_j12_campeonato_estat_equipes_time (team_id),
        UNIQUE KEY uniq_j12_campeonato_estat_equipes_insc (championship_id, registration_id)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        registration_id VARCHAR(64) NULL,
        team_id VARCHAR(64) NULL,
        team_name VARCHAR(191) NULL,
        team_acronym VARCHAR(40) NULL,
        player_id VARCHAR(64) NOT NULL,
        player_name VARCHAR(191) NULL,
        shirt_number INT NULL,
        matches_played INT NOT NULL DEFAULT 0,
        goals INT NOT NULL DEFAULT 0,
        yellow_cards INT NOT NULL DEFAULT 0,
        red_cards INT NOT NULL DEFAULT 0,
        calculated_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_estat_atletas_camp (championship_id),
        INDEX idx_j12_campeonato_estat_atletas_time (team_id),
        INDEX idx_j12_campeonato_estat_atletas_gols (championship_id, goals),
        UNIQUE KEY uniq_j12_campeonato_estat_atletas_player (
          championship_id,
          registration_id,
          player_id
        )
      )
    `);
  }

  async replaceByChampionship(championshipId, snapshot = {}) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const values = normalizeSnapshotInput(campId, snapshot);

    const work = async (executor) => {
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_STATISTICS_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );

      await runQuery(
        executor,
        `
          INSERT INTO ${CHAMPIONSHIP_STATISTICS_TABLE_NAME} (
            id,
            championship_id,
            matches_played,
            finished_matches,
            goals_scored,
            goals_average,
            yellow_cards,
            red_cards,
            walkovers,
            calculated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          values.championship.id,
          values.championship.championshipId,
          values.championship.matchesPlayed,
          values.championship.finishedMatches,
          values.championship.goalsScored,
          values.championship.goalsAverage,
          values.championship.yellowCards,
          values.championship.redCards,
          values.championship.walkovers,
          values.championship.calculatedAt,
        ],
      );

      for (const team of values.teams) {
        await insertTeamStatistics(executor, team);
      }

      for (const player of values.players) {
        await insertPlayerStatistics(executor, player);
      }
    };

    if (typeof this.transaction === "function") {
      await this.transaction(work);
    } else {
      await work(this.query);
    }

    return this.findByChampionship(campId);
  }

  async findByChampionship(championshipId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const championshipRows = await this.query(
      `
        SELECT ${STATISTICS_COLUMNS}
        FROM ${CHAMPIONSHIP_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
        LIMIT 1
      `,
      [campId],
    );
    const championship = mapChampionshipStatisticsRow(readFirstRow(championshipRows));

    if (!championship) return null;

    const teamRows = await this.query(
      `
        SELECT ${TEAM_STATISTICS_COLUMNS}
        FROM ${CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
        ORDER BY team_name ASC, registration_id ASC
      `,
      [campId],
    );
    const playerRows = await this.query(
      `
        SELECT ${PLAYER_STATISTICS_COLUMNS}
        FROM ${CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
        ORDER BY goals DESC, player_name ASC, player_id ASC
      `,
      [campId],
    );

    return {
      championship,
      players: readRows(playerRows).map(mapPlayerStatisticsRow).filter(Boolean),
      teams: readRows(teamRows).map(mapTeamStatisticsRow).filter(Boolean),
    };
  }

  async fetchCalculationData(championshipId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const reportRows = await this.query(
      `
        SELECT
          report.id,
          report.match_id,
          report.championship_id,
          report.status,
          report.home_score,
          report.away_score,
          report.finished_at,
          match_item.status AS match_status,
          match_item.home_score AS match_home_score,
          match_item.away_score AS match_away_score,
          match_item.home_registration_id,
          match_item.away_registration_id,
          match_item.match_date,
          match_item.start_time,
          round_item.round_number,
          home_registration.team_id AS home_team_id,
          home_team.name AS home_team_name,
          home_team.acronym AS home_team_acronym,
          away_registration.team_id AS away_team_id,
          away_team.name AS away_team_name,
          away_team.acronym AS away_team_acronym
        FROM ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME} report
        LEFT JOIN ${CHAMPIONSHIP_MATCH_TABLE_NAME} match_item
          ON match_item.id = report.match_id
        LEFT JOIN ${CHAMPIONSHIP_ROUND_TABLE_NAME} round_item
          ON round_item.id = match_item.round_id
        LEFT JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
          ON group_item.id = match_item.group_id
        LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} home_registration
          ON home_registration.id = match_item.home_registration_id
          AND home_registration.deleted_at IS NULL
        LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} away_registration
          ON away_registration.id = match_item.away_registration_id
          AND away_registration.deleted_at IS NULL
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} home_team
          ON home_team.id = home_registration.team_id
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} away_team
          ON away_team.id = away_registration.team_id
        WHERE report.championship_id = ?
        ORDER BY match_item.match_date ASC,
                 match_item.start_time ASC,
                 round_item.round_number ASC,
                 report.match_id ASC
      `,
      [campId],
    );
    const eventRows = await this.query(
      `
        SELECT
          event_item.id,
          event_item.report_id,
          event_item.match_id,
          event_item.championship_id,
          event_item.team_registration_id,
          event_item.player_id,
          event_item.related_player_id,
          event_item.event_type,
          event_item.minute,
          report.status AS report_status,
          team_registration.team_id AS team_id,
          team.name AS team_name,
          team.acronym AS team_acronym,
          player.name AS player_name,
          player.shirt_number AS player_shirt_number,
          related_player.name AS related_player_name,
          related_player.shirt_number AS related_player_shirt_number
        FROM ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME} event_item
        LEFT JOIN ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME} report
          ON report.id = event_item.report_id
        LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} team_registration
          ON team_registration.id = event_item.team_registration_id
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} team
          ON team.id = team_registration.team_id
        LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} player
          ON player.id = event_item.player_id
          AND player.registration_id = event_item.team_registration_id
        LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} related_player
          ON related_player.id = event_item.related_player_id
          AND related_player.registration_id = event_item.team_registration_id
        WHERE event_item.championship_id = ?
        ORDER BY event_item.match_id ASC,
                 event_item.minute IS NULL,
                 event_item.minute ASC,
                 event_item.created_at ASC
      `,
      [campId],
    );

    return {
      events: readRows(eventRows).map(mapCalculationEventRow).filter(Boolean),
      reports: readRows(reportRows).map(mapCalculationReportRow).filter(Boolean),
    };
  }

  async deleteByChampionship(championshipId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
      `,
      [campId],
    );
    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
      `,
      [campId],
    );
    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_STATISTICS_TABLE_NAME}
        WHERE championship_id = ?
      `,
      [campId],
    );
  }
}

async function insertTeamStatistics(executor, team) {
  await runQuery(
    executor,
    `
      INSERT INTO ${CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME} (
        id,
        championship_id,
        registration_id,
        team_id,
        team_name,
        team_acronym,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        performance,
        result_streak_json,
        yellow_cards,
        red_cards,
        walkovers,
        calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      team.id,
      team.championshipId,
      team.registrationId,
      team.teamId,
      team.teamName,
      team.teamAcronym,
      team.matches,
      team.wins,
      team.draws,
      team.losses,
      team.goalsFor,
      team.goalsAgainst,
      team.goalDifference,
      team.points,
      team.performance,
      JSON.stringify(team.resultStreak || []),
      team.yellowCards,
      team.redCards,
      team.walkovers,
      team.calculatedAt,
    ],
  );
}

async function insertPlayerStatistics(executor, player) {
  await runQuery(
    executor,
    `
      INSERT INTO ${CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME} (
        id,
        championship_id,
        registration_id,
        team_id,
        team_name,
        team_acronym,
        player_id,
        player_name,
        shirt_number,
        matches_played,
        goals,
        yellow_cards,
        red_cards,
        calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      player.id,
      player.championshipId,
      player.registrationId,
      player.teamId,
      player.teamName,
      player.teamAcronym,
      player.playerId,
      player.playerName,
      player.shirtNumber,
      player.matches,
      player.goals,
      player.yellowCards,
      player.redCards,
      player.calculatedAt,
    ],
  );
}

function mapChampionshipStatisticsRow(row) {
  if (!row) return null;
  return ChampionshipStatistics.fromPersistence(row);
}

function mapTeamStatisticsRow(row) {
  if (!row) return null;
  return ChampionshipTeamStatistics.fromPersistence({
    ...row,
    matches: row.matches_played ?? row.matches,
  });
}

function mapPlayerStatisticsRow(row) {
  if (!row) return null;
  return ChampionshipPlayerStatistics.fromPersistence({
    ...row,
    matches: row.matches_played ?? row.matches,
  });
}

function mapCalculationReportRow(row) {
  if (!row) return null;

  return {
    awayRegistrationId: row.away_registration_id,
    awayScore: row.away_score,
    awayTeamAcronym: row.away_team_acronym,
    awayTeamId: row.away_team_id,
    awayTeamName: row.away_team_name,
    championshipId: row.championship_id,
    finishedAt: row.finished_at,
    homeRegistrationId: row.home_registration_id,
    homeScore: row.home_score,
    homeTeamAcronym: row.home_team_acronym,
    homeTeamId: row.home_team_id,
    homeTeamName: row.home_team_name,
    id: row.id,
    matchAwayScore: row.match_away_score,
    matchDate: row.match_date,
    matchHomeScore: row.match_home_score,
    matchId: row.match_id,
    matchStatus: row.match_status,
    roundNumber: row.round_number,
    startTime: row.start_time,
    status: row.status,
  };
}

function mapCalculationEventRow(row) {
  if (!row) return null;

  return {
    championshipId: row.championship_id,
    eventType: row.event_type,
    id: row.id,
    matchId: row.match_id,
    minute: row.minute,
    playerId: row.player_id,
    playerName: row.player_name,
    playerShirtNumber: row.player_shirt_number,
    relatedPlayerId: row.related_player_id,
    relatedPlayerName: row.related_player_name,
    relatedPlayerShirtNumber: row.related_player_shirt_number,
    reportId: row.report_id,
    reportStatus: row.report_status,
    teamAcronym: row.team_acronym,
    teamId: row.team_id,
    teamName: row.team_name,
    teamRegistrationId: row.team_registration_id,
  };
}

function normalizeSnapshotInput(championshipId, snapshot = {}) {
  const calculatedAt = toSqlDateTime(new Date());
  const championship = normalizeChampionshipStatisticsInput({
    ...(snapshot.championship || snapshot.statistics || {}),
    calculatedAt,
    championshipId,
  });

  return {
    championship,
    players: (snapshot.players || snapshot.athletes || []).map((player) =>
      normalizePlayerStatisticsInput({
        ...player,
        calculatedAt: championship.calculatedAt,
        championshipId,
      }),
    ),
    teams: (snapshot.teams || []).map((team) =>
      normalizeTeamStatisticsInput({
        ...team,
        calculatedAt: championship.calculatedAt,
        championshipId,
      }),
    ),
  };
}

function normalizeChampionshipStatisticsInput(input = {}) {
  return {
    calculatedAt: input.calculatedAt || toSqlDateTime(new Date()),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    finishedMatches: normalizeInteger(input.finishedMatches),
    goalsAverage: normalizeDecimal(input.goalsAverage),
    goalsScored: normalizeInteger(input.goalsScored),
    id: nullableText(input.id, 64) || createId("estatistica"),
    matchesPlayed: normalizeInteger(input.matchesPlayed),
    redCards: normalizeInteger(input.redCards),
    walkovers: normalizeInteger(input.walkovers),
    yellowCards: normalizeInteger(input.yellowCards),
  };
}

function normalizeTeamStatisticsInput(input = {}) {
  return {
    calculatedAt: input.calculatedAt || toSqlDateTime(new Date()),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    draws: normalizeInteger(input.draws),
    goalDifference: normalizeInteger(input.goalDifference),
    goalsAgainst: normalizeInteger(input.goalsAgainst),
    goalsFor: normalizeInteger(input.goalsFor),
    id: nullableText(input.id, 64) || createId("estatistica-equipe"),
    losses: normalizeInteger(input.losses),
    matches: normalizeInteger(input.matches),
    performance: normalizeDecimal(input.performance),
    points: normalizeInteger(input.points),
    redCards: normalizeInteger(input.redCards),
    registrationId: requiredText(input.registrationId, "registrationId", 64),
    resultStreak: Array.isArray(input.resultStreak) ? input.resultStreak : [],
    teamAcronym: nullableText(input.teamAcronym, 40),
    teamId: nullableText(input.teamId, 64),
    teamName: nullableText(input.teamName, 191),
    walkovers: normalizeInteger(input.walkovers),
    wins: normalizeInteger(input.wins),
    yellowCards: normalizeInteger(input.yellowCards),
  };
}

function normalizePlayerStatisticsInput(input = {}) {
  return {
    calculatedAt: input.calculatedAt || toSqlDateTime(new Date()),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    goals: normalizeInteger(input.goals),
    id: nullableText(input.id, 64) || createId("estatistica-atleta"),
    matches: normalizeInteger(input.matches),
    playerId: requiredText(input.playerId, "playerId", 64),
    playerName: nullableText(input.playerName, 191),
    redCards: normalizeInteger(input.redCards),
    registrationId: nullableText(input.registrationId, 64),
    shirtNumber: normalizeNullableInteger(input.shirtNumber),
    teamAcronym: nullableText(input.teamAcronym, 40),
    teamId: nullableText(input.teamId, 64),
    teamName: nullableText(input.teamName, 191),
    yellowCards: normalizeInteger(input.yellowCards),
  };
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeNullableInteger(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeDecimal(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function toSqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
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

  throw new Error("Executor SQL invalido para transacao de estatisticas.");
}

module.exports = {
  MySqlChampionshipStatisticsRepository,
};
