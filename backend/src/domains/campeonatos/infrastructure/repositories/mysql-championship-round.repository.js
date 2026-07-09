const { query } = require("../../../../config/db.js");
const { ChampionshipMatch, ChampionshipRound } = require("../../domain/entities/index.js");
const {
  CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_MATCH_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_ROUND_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
} = require("../../shared/constants/index.js");
const { MySqlChampionshipGroupRepository } = require("./mysql-championship-group.repository.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const ROUND_SORT_COLUMNS = Object.freeze({
  createdAt: "round_item.created_at",
  name: "round_item.name",
  roundNumber: "round_item.round_number",
});

const MATCH_SORT_COLUMNS = Object.freeze({
  court: "match_item.court",
  createdAt: "match_item.created_at",
  matchDate: "match_item.match_date",
  roundNumber: "round_item.round_number",
  startTime: "match_item.start_time",
  status: "match_item.status",
});

class MySqlChampionshipRoundRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
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
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_ROUND_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        name VARCHAR(80) NULL,
        round_number INT NOT NULL,
        phase VARCHAR(32) NOT NULL DEFAULT 'GROUP_STAGE',
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_rodadas_camp (championship_id),
        INDEX idx_j12_campeonato_rodadas_fase (championship_id, phase),
        UNIQUE KEY uniq_j12_campeonato_rodadas_numero (championship_id, phase, round_number)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_MATCH_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        round_id VARCHAR(64) NOT NULL,
        phase VARCHAR(32) NOT NULL DEFAULT 'GROUP_STAGE',
        group_id VARCHAR(64) NOT NULL,
        home_registration_id VARCHAR(64) NOT NULL,
        away_registration_id VARCHAR(64) NOT NULL,
        match_date DATE NULL,
        start_time VARCHAR(5) NULL,
        court VARCHAR(120) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        home_score INT NULL,
        away_score INT NULL,
        result_updated_by VARCHAR(191) NULL,
        result_updated_at DATETIME NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_jogos_camp (championship_id),
        INDEX idx_j12_campeonato_jogos_rodada (round_id),
        INDEX idx_j12_campeonato_jogos_grupo (group_id),
        INDEX idx_j12_campeonato_jogos_fase (championship_id, phase),
        INDEX idx_j12_campeonato_jogos_status (status),
        INDEX idx_j12_campeonato_jogos_data (match_date, start_time, court),
        INDEX idx_j12_campeonato_jogos_equipes (
          championship_id,
          phase,
          group_id,
          home_registration_id,
          away_registration_id
        )
      )
    `);
    await this.ensureMatchResultColumns();
  }

  async ensureMatchResultColumns() {
    await this.ensureColumn("home_score", "INT NULL");
    await this.ensureColumn("away_score", "INT NULL");
    await this.ensureColumn("result_updated_by", "VARCHAR(191) NULL");
    await this.ensureColumn("result_updated_at", "DATETIME NULL");
  }

  async ensureColumn(columnName, definition) {
    const rows = await this.query(`SHOW COLUMNS FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME} LIKE ?`, [
      columnName,
    ]);

    if (readRows(rows).length > 0) return;

    await this.query(`
      ALTER TABLE ${CHAMPIONSHIP_MATCH_TABLE_NAME}
      ADD COLUMN ${columnName} ${definition}
    `);
  }

  async createRound(input = {}) {
    await this.ensureSchema();
    const values = normalizeRoundCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_ROUND_TABLE_NAME} (
          id,
          championship_id,
          name,
          round_number,
          phase,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.championshipId,
        values.name,
        values.roundNumber,
        values.phase,
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findRoundById(values.championshipId, values.id);
  }

  async updateRound(championshipId, roundId, input = {}) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(roundId, "roundId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(assignments, params, input, "name", "name", (value) => nullableText(value, 80));
    pushAssignment(assignments, params, input, "phase", "phase", (value) =>
      requiredText(value, "phase", 32),
    );
    pushAssignment(assignments, params, input, "roundNumber", "round_number", normalizeRoundNumber);

    if (assignments.length === 0) {
      return this.findRoundById(campId, id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191));
    params.push(campId, id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_ROUND_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE championship_id = ?
          AND id = ?
      `,
      params,
    );

    const round = await this.findRoundById(campId, id);

    if (round) {
      await this.query(
        `
          UPDATE ${CHAMPIONSHIP_MATCH_TABLE_NAME}
          SET phase = ?,
              updated_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE championship_id = ?
            AND round_id = ?
        `,
        [round.phase, nullableText(input.updatedBy, 191), campId, id],
      );
    }

    return round;
  }

  async deleteRound(championshipId, roundId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(roundId, "roundId", 64);
    const round = await this.findRoundById(campId, id);

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_ROUND_TABLE_NAME}
        WHERE championship_id = ?
          AND id = ?
      `,
      [campId, id],
    );

    return round;
  }

  async findRoundsByChampionship(filters = {}) {
    await this.ensureSchema();
    const params = [requiredText(filters.championshipId, "championshipId", 64)];
    const where = ["round_item.championship_id = ?"];

    if (filters.phase) {
      where.push("round_item.phase = ?");
      params.push(requiredText(filters.phase, "phase", 32));
    }

    if (filters.search) {
      where.push("(LOWER(round_item.name) LIKE ? OR CAST(round_item.round_number AS CHAR) LIKE ?)");
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search);
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_ROUND_TABLE_NAME} round_item
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn = ROUND_SORT_COLUMNS[filters.sortBy] || ROUND_SORT_COLUMNS.roundNumber;
    const orderDirection = filters.sortDirection === "DESC" ? "DESC" : "ASC";
    const rows = await this.query(
      `
        ${baseRoundSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, round_item.round_number ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );
    const items = readRows(rows).map(mapRoundRow).filter(Boolean);

    await this.attachMatches(items);

    return {
      items,
      total,
    };
  }

  async findRoundById(championshipId, roundId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseRoundSelect()}
        WHERE round_item.championship_id = ?
          AND round_item.id = ?
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(roundId, "roundId", 64)],
    );
    const round = mapRoundRow(readFirstRow(rows));

    if (round) {
      await this.attachMatches([round]);
    }

    return round;
  }

  async findRoundByNumber(championshipId, phase, roundNumber) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseRoundSelect()}
        WHERE round_item.championship_id = ?
          AND round_item.phase = ?
          AND round_item.round_number = ?
        LIMIT 1
      `,
      [
        requiredText(championshipId, "championshipId", 64),
        requiredText(phase, "phase", 32),
        normalizeRoundNumber(roundNumber),
      ],
    );

    return mapRoundRow(readFirstRow(rows));
  }

  async getNextRoundNumber(championshipId, phase) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT MAX(round_number) AS round_number
        FROM ${CHAMPIONSHIP_ROUND_TABLE_NAME}
        WHERE championship_id = ?
          AND phase = ?
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(phase, "phase", 32)],
    );

    return Number(readFirstRow(rows)?.round_number || 0) + 1;
  }

  async countMatchesByRound(roundId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        WHERE round_id = ?
      `,
      [requiredText(roundId, "roundId", 64)],
    );

    return Number(readFirstRow(rows)?.total || 0);
  }

  async createMatch(input = {}) {
    await this.ensureSchema();
    const values = normalizeMatchCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_MATCH_TABLE_NAME} (
          id,
          championship_id,
          round_id,
          phase,
          group_id,
          home_registration_id,
          away_registration_id,
          match_date,
          start_time,
          court,
          status,
          home_score,
          away_score,
          result_updated_by,
          result_updated_at,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.championshipId,
        values.roundId,
        values.phase,
        values.groupId,
        values.homeRegistrationId,
        values.awayRegistrationId,
        values.matchDate,
        values.startTime,
        values.court,
        values.status,
        values.homeScore,
        values.awayScore,
        values.resultUpdatedBy,
        values.hasResult ? toSqlDateTime(new Date()) : null,
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findMatchById(values.championshipId, values.id);
  }

  async updateMatch(championshipId, matchId, input = {}) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(matchId, "matchId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(
      assignments,
      params,
      input,
      "awayRegistrationId",
      "away_registration_id",
      (value) => requiredText(value, "awayRegistrationId", 64),
    );
    pushAssignment(assignments, params, input, "court", "court", (value) =>
      nullableText(value, 120),
    );
    pushAssignment(assignments, params, input, "groupId", "group_id", (value) =>
      requiredText(value, "groupId", 64),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "homeRegistrationId",
      "home_registration_id",
      (value) => requiredText(value, "homeRegistrationId", 64),
    );
    pushAssignment(assignments, params, input, "homeScore", "home_score", normalizeScore);
    pushAssignment(assignments, params, input, "matchDate", "match_date", (value) =>
      nullableText(value, 32),
    );
    pushAssignment(assignments, params, input, "awayScore", "away_score", normalizeScore);
    pushAssignment(assignments, params, input, "phase", "phase", (value) =>
      requiredText(value, "phase", 32),
    );
    pushAssignment(assignments, params, input, "startTime", "start_time", (value) =>
      nullableText(value, 5),
    );
    pushAssignment(assignments, params, input, "status", "status", (value) =>
      requiredText(value, "status", 32),
    );

    if (assignments.length === 0) {
      return this.findMatchById(campId, id);
    }

    if (
      Object.prototype.hasOwnProperty.call(input, "homeScore") ||
      Object.prototype.hasOwnProperty.call(input, "awayScore")
    ) {
      assignments.push("result_updated_by = ?");
      assignments.push("result_updated_at = CURRENT_TIMESTAMP");
      params.push(nullableText(input.updatedBy, 191));
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191));
    params.push(campId, id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE championship_id = ?
          AND id = ?
      `,
      params,
    );

    return this.findMatchById(campId, id);
  }

  async deleteMatch(championshipId, matchId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(matchId, "matchId", 64);
    const match = await this.findMatchById(campId, id);

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        WHERE championship_id = ?
          AND id = ?
      `,
      [campId, id],
    );

    return match;
  }

  async moveMatch(championshipId, matchId, input = {}) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(matchId, "matchId", 64);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        SET round_id = ?,
            phase = ?,
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE championship_id = ?
          AND id = ?
      `,
      [
        requiredText(input.targetRoundId, "targetRoundId", 64),
        requiredText(input.phase, "phase", 32),
        nullableText(input.updatedBy, 191),
        campId,
        id,
      ],
    );

    return this.findMatchById(campId, id);
  }

  async findMatchById(championshipId, matchId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE match_item.championship_id = ?
          AND match_item.id = ?
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(matchId, "matchId", 64)],
    );

    return mapMatchRow(readFirstRow(rows));
  }

  async findMatches(filters = {}) {
    await this.ensureSchema();
    const params = [requiredText(filters.championshipId, "championshipId", 64)];
    const where = ["match_item.championship_id = ?"];

    if (filters.groupId) {
      where.push("match_item.group_id = ?");
      params.push(requiredText(filters.groupId, "groupId", 64));
    }

    if (filters.phase) {
      where.push("match_item.phase = ?");
      params.push(requiredText(filters.phase, "phase", 32));
    }

    if (filters.roundId) {
      where.push("match_item.round_id = ?");
      params.push(requiredText(filters.roundId, "roundId", 64));
    }

    if (filters.status) {
      where.push("match_item.status = ?");
      params.push(requiredText(filters.status, "status", 32));
    }

    if (filters.search) {
      where.push(
        "(LOWER(home_team.name) LIKE ? OR LOWER(away_team.name) LIKE ? OR LOWER(group_item.name) LIKE ? OR LOWER(match_item.court) LIKE ?)",
      );
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search, search, search);
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME} match_item
        INNER JOIN ${CHAMPIONSHIP_ROUND_TABLE_NAME} round_item
          ON round_item.id = match_item.round_id
        INNER JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
          ON group_item.id = match_item.group_id
        INNER JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} home_registration
          ON home_registration.id = match_item.home_registration_id
        INNER JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} away_registration
          ON away_registration.id = match_item.away_registration_id
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} home_team
          ON home_team.id = home_registration.team_id
        LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} away_team
          ON away_team.id = away_registration.team_id
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn = MATCH_SORT_COLUMNS[filters.sortBy] || MATCH_SORT_COLUMNS.roundNumber;
    const orderDirection = filters.sortDirection === "DESC" ? "DESC" : "ASC";
    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, match_item.created_at ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: readRows(rows).map(mapMatchRow).filter(Boolean),
      total,
    };
  }

  async findDuplicateMatch(filters = {}) {
    await this.ensureSchema();
    const params = [
      requiredText(filters.championshipId, "championshipId", 64),
      requiredText(filters.phase, "phase", 32),
      requiredText(filters.groupId, "groupId", 64),
      requiredText(filters.homeRegistrationId, "homeRegistrationId", 64),
      requiredText(filters.awayRegistrationId, "awayRegistrationId", 64),
      requiredText(filters.awayRegistrationId, "awayRegistrationId", 64),
      requiredText(filters.homeRegistrationId, "homeRegistrationId", 64),
    ];
    const where = [
      "match_item.championship_id = ?",
      "match_item.phase = ?",
      "match_item.group_id = ?",
      "((match_item.home_registration_id = ? AND match_item.away_registration_id = ?) OR (match_item.home_registration_id = ? AND match_item.away_registration_id = ?))",
    ];

    if (filters.ignoredMatchId) {
      where.push("match_item.id <> ?");
      params.push(requiredText(filters.ignoredMatchId, "ignoredMatchId", 64));
    }

    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `,
      params,
    );

    return mapMatchRow(readFirstRow(rows));
  }

  async findCourtConflict(filters = {}) {
    await this.ensureSchema();
    const params = [
      requiredText(filters.championshipId, "championshipId", 64),
      requiredText(filters.matchDate, "matchDate", 32),
      requiredText(filters.startTime, "startTime", 5),
      requiredText(filters.court, "court", 120).toLowerCase(),
    ];
    const where = [
      "match_item.championship_id = ?",
      "match_item.match_date = ?",
      "match_item.start_time = ?",
      "LOWER(match_item.court) = ?",
      "match_item.status <> 'CANCELLED'",
    ];

    if (filters.ignoredMatchId) {
      where.push("match_item.id <> ?");
      params.push(requiredText(filters.ignoredMatchId, "ignoredMatchId", 64));
    }

    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `,
      params,
    );

    return mapMatchRow(readFirstRow(rows));
  }

  async countMatchesByPhase(championshipId, phase) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        WHERE championship_id = ?
          AND phase = ?
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(phase, "phase", 32)],
    );

    return Number(readFirstRow(rows)?.total || 0);
  }

  async deleteMatchesByPhase(championshipId, phase) {
    await this.ensureSchema();
    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME}
        WHERE championship_id = ?
          AND phase = ?
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(phase, "phase", 32)],
    );
  }

  async attachMatches(rounds = []) {
    if (rounds.length === 0) return;

    const ids = rounds.map((round) => round.id).filter(Boolean);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE match_item.round_id IN (${placeholders})
        ORDER BY round_item.round_number ASC, group_item.display_order ASC, match_item.created_at ASC
      `,
      ids,
    );
    const matchesByRound = new Map();

    for (const match of readRows(rows).map(mapMatchRow).filter(Boolean)) {
      const current = matchesByRound.get(match.roundId) || [];
      current.push(match);
      matchesByRound.set(match.roundId, current);
    }

    for (const round of rounds) {
      round.matches = matchesByRound.get(round.id) || [];
    }
  }
}

function normalizeRoundCreateInput(input = {}) {
  return {
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    id: nullableText(input.id, 64) || createId("rodada"),
    name: nullableText(input.name, 80),
    phase: requiredText(input.phase, "phase", 32),
    roundNumber: normalizeRoundNumber(input.roundNumber),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function normalizeMatchCreateInput(input = {}) {
  return {
    awayRegistrationId: requiredText(input.awayRegistrationId, "awayRegistrationId", 64),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    court: nullableText(input.court, 120),
    createdBy: nullableText(input.createdBy, 191),
    groupId: requiredText(input.groupId, "groupId", 64),
    homeRegistrationId: requiredText(input.homeRegistrationId, "homeRegistrationId", 64),
    id: nullableText(input.id, 64) || createId("jogo"),
    matchDate: nullableText(input.matchDate, 32),
    phase: requiredText(input.phase, "phase", 32),
    roundId: requiredText(input.roundId, "roundId", 64),
    startTime: nullableText(input.startTime, 5),
    status: requiredText(input.status, "status", 32),
    awayScore: normalizeScore(input.awayScore),
    hasResult:
      input.homeScore !== null &&
      input.homeScore !== undefined &&
      input.awayScore !== null &&
      input.awayScore !== undefined,
    homeScore: normalizeScore(input.homeScore),
    resultUpdatedBy: nullableText(input.updatedBy, 191),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function baseRoundSelect() {
  return `
    SELECT
      round_item.*
    FROM ${CHAMPIONSHIP_ROUND_TABLE_NAME} round_item
  `;
}

function baseMatchSelect() {
  return `
    SELECT
      match_item.*,
      round_item.name AS round_name,
      round_item.round_number,
      group_item.name AS group_name,
      home_registration.team_id AS home_team_id,
      home_team.name AS home_team_name,
      home_team.acronym AS home_team_acronym,
      away_registration.team_id AS away_team_id,
      away_team.name AS away_team_name,
      away_team.acronym AS away_team_acronym
    FROM ${CHAMPIONSHIP_MATCH_TABLE_NAME} match_item
    INNER JOIN ${CHAMPIONSHIP_ROUND_TABLE_NAME} round_item
      ON round_item.id = match_item.round_id
    INNER JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
      ON group_item.id = match_item.group_id
    INNER JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} home_registration
      ON home_registration.id = match_item.home_registration_id
      AND home_registration.deleted_at IS NULL
    INNER JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} away_registration
      ON away_registration.id = match_item.away_registration_id
      AND away_registration.deleted_at IS NULL
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} home_team
      ON home_team.id = home_registration.team_id
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} away_team
      ON away_team.id = away_registration.team_id
  `;
}

function mapRoundRow(row) {
  if (!row) return null;

  return ChampionshipRound.fromPersistence({
    championship_id: row.championship_id,
    created_at: row.created_at,
    created_by: row.created_by,
    id: row.id,
    name: row.name,
    phase: row.phase,
    round_number: row.round_number,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function mapMatchRow(row) {
  if (!row) return null;

  return ChampionshipMatch.fromPersistence({
    away_registration_id: row.away_registration_id,
    away_score: row.away_score,
    away_team_acronym: row.away_team_acronym,
    away_team_id: row.away_team_id,
    away_team_name: row.away_team_name,
    championship_id: row.championship_id,
    court: row.court,
    created_at: row.created_at,
    created_by: row.created_by,
    group_id: row.group_id,
    group_name: row.group_name,
    home_registration_id: row.home_registration_id,
    home_score: row.home_score,
    home_team_acronym: row.home_team_acronym,
    home_team_id: row.home_team_id,
    home_team_name: row.home_team_name,
    id: row.id,
    match_date: row.match_date,
    phase: row.phase,
    round_id: row.round_id,
    round_name: row.round_name,
    round_number: row.round_number,
    result_updated_at: row.result_updated_at,
    result_updated_by: row.result_updated_by,
    start_time: row.start_time,
    status: text(row.status, 32),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function pushAssignment(assignments, params, input, sourceField, columnName, normalize) {
  if (
    !Object.prototype.hasOwnProperty.call(input, sourceField) ||
    typeof input[sourceField] === "undefined"
  ) {
    return;
  }

  assignments.push(`${columnName} = ?`);
  params.push(normalize(input[sourceField]));
}

function normalizeRoundNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function toSqlDateTime(value) {
  return value.toISOString().slice(0, 19).replace("T", " ");
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

module.exports = {
  MySqlChampionshipRoundRepository,
};
