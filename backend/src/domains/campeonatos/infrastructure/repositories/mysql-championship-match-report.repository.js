const { query } = require("../../../../config/db.js");
const {
  ChampionshipMatch,
  ChampionshipMatchEvent,
  ChampionshipMatchReport,
} = require("../../domain/entities/index.js");
const {
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME,
  CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME,
  CHAMPIONSHIP_MATCH_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_ROUND_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
  ChampionshipMatchReportStatus,
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
const {
  MySqlChampionshipRegistrationPlayerRepository,
} = require("./mysql-championship-registration-player.repository.js");
const { MySqlChampionshipRoundRepository } = require("./mysql-championship-round.repository.js");

class MySqlChampionshipMatchReportRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.roundSchemaRepository =
      options.roundSchemaRepository ||
      new MySqlChampionshipRoundRepository({
        queryRunner: this.query,
        transactionRunner: options.transactionRunner || null,
      });
    this.playerSchemaRepository =
      options.playerSchemaRepository ||
      new MySqlChampionshipRegistrationPlayerRepository({
        queryRunner: this.query,
        transactionRunner: options.transactionRunner || null,
      });
  }

  async ensureSchema() {
    await this.roundSchemaRepository.ensureSchema();
    await this.playerSchemaRepository.ensureSchema();
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        championship_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        referee VARCHAR(191) NULL,
        assistant_referee VARCHAR(191) NULL,
        scorer VARCHAR(191) NULL,
        observations TEXT NULL,
        home_score INT NULL,
        away_score INT NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_j12_campeonato_sumulas_jogo (match_id),
        INDEX idx_j12_campeonato_sumulas_camp (championship_id),
        INDEX idx_j12_campeonato_sumulas_status (status)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        report_id VARCHAR(64) NOT NULL,
        match_id VARCHAR(64) NOT NULL,
        championship_id VARCHAR(64) NOT NULL,
        team_registration_id VARCHAR(64) NULL,
        player_id VARCHAR(64) NULL,
        related_player_id VARCHAR(64) NULL,
        event_type VARCHAR(32) NOT NULL,
        minute INT NULL,
        period VARCHAR(32) NULL,
        description TEXT NULL,
        metadata_json TEXT NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_sumula_eventos_sumula (report_id),
        INDEX idx_j12_campeonato_sumula_eventos_jogo (match_id),
        INDEX idx_j12_campeonato_sumula_eventos_camp (championship_id),
        INDEX idx_j12_campeonato_sumula_eventos_tipo (event_type),
        INDEX idx_j12_campeonato_sumula_eventos_time (team_registration_id),
        INDEX idx_j12_campeonato_sumula_eventos_atleta (player_id)
      )
    `);
  }

  async createReport(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateReportInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME} (
          id,
          match_id,
          championship_id,
          status,
          referee,
          assistant_referee,
          scorer,
          observations,
          home_score,
          away_score,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.matchId,
        values.championshipId,
        values.status,
        values.referee,
        values.assistantReferee,
        values.scorer,
        values.observations,
        values.homeScore,
        values.awayScore,
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findReportByMatchId(values.matchId);
  }

  async updateReport(reportId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(reportId, "reportId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(assignments, params, input, "assistantReferee", "assistant_referee", (value) =>
      nullableText(value, 191),
    );
    pushAssignment(assignments, params, input, "observations", "observations", (value) =>
      nullableText(value, 2000),
    );
    pushAssignment(assignments, params, input, "referee", "referee", (value) =>
      nullableText(value, 191),
    );
    pushAssignment(assignments, params, input, "scorer", "scorer", (value) =>
      nullableText(value, 191),
    );

    if (assignments.length === 0) {
      return this.findReportById(id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191), id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      params,
    );

    return this.findReportById(id);
  }

  async updateReportScore(reportId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(reportId, "reportId", 64);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME}
        SET home_score = ?,
            away_score = ?,
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        normalizeScore(input.homeScore),
        normalizeScore(input.awayScore),
        nullableText(input.updatedBy, 191),
        id,
      ],
    );

    return this.findReportById(id);
  }

  async updateReportStatus(reportId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(reportId, "reportId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(assignments, params, input, "finishedAt", "finished_at", toSqlDateTime);
    pushAssignment(assignments, params, input, "startedAt", "started_at", toSqlDateTime);
    pushAssignment(assignments, params, input, "status", "status", (value) =>
      requiredText(value, "status", 32),
    );

    if (assignments.length === 0) {
      return this.findReportById(id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191), id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      params,
    );

    return this.findReportById(id);
  }

  async findReportByMatchId(matchId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseReportSelect()}
        WHERE report.match_id = ?
        LIMIT 1
      `,
      [requiredText(matchId, "matchId", 64)],
    );
    const report = mapReportRow(readFirstRow(rows));

    if (!report) return null;

    report.match = await this.findMatchById(report.matchId);
    report.events = await this.findEventsByReportId(report.id);
    return report;
  }

  async findReportById(reportId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseReportSelect()}
        WHERE report.id = ?
        LIMIT 1
      `,
      [requiredText(reportId, "reportId", 64)],
    );
    const report = mapReportRow(readFirstRow(rows));

    if (!report) return null;

    report.match = await this.findMatchById(report.matchId);
    report.events = await this.findEventsByReportId(report.id);
    return report;
  }

  async findMatchById(matchId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE match_item.id = ?
        LIMIT 1
      `,
      [requiredText(matchId, "matchId", 64)],
    );

    return mapMatchRow(readFirstRow(rows));
  }

  async createEvent(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateEventInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME} (
          id,
          report_id,
          match_id,
          championship_id,
          team_registration_id,
          player_id,
          related_player_id,
          event_type,
          minute,
          period,
          description,
          metadata_json,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.reportId,
        values.matchId,
        values.championshipId,
        values.teamRegistrationId,
        values.playerId,
        values.relatedPlayerId,
        values.eventType,
        values.minute,
        values.period,
        values.description,
        JSON.stringify(values.metadata || {}),
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findEventById(values.reportId, values.id);
  }

  async updateEvent(eventId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(eventId, "eventId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(assignments, params, input, "description", "description", (value) =>
      nullableText(value, 2000),
    );
    pushAssignment(assignments, params, input, "eventType", "event_type", (value) =>
      requiredText(value, "eventType", 32),
    );
    pushAssignment(assignments, params, input, "metadata", "metadata_json", (value) =>
      JSON.stringify(value || {}),
    );
    pushAssignment(assignments, params, input, "minute", "minute", normalizeNullableInteger);
    pushAssignment(assignments, params, input, "period", "period", (value) =>
      nullableText(value, 32),
    );
    pushAssignment(assignments, params, input, "playerId", "player_id", (value) =>
      nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "relatedPlayerId", "related_player_id", (value) =>
      nullableText(value, 64),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "teamRegistrationId",
      "team_registration_id",
      (value) => nullableText(value, 64),
    );

    if (assignments.length === 0) {
      return this.findEventById(null, id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191), id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      params,
    );

    return this.findEventById(null, id);
  }

  async deleteEvent(eventId) {
    await this.ensureSchema();
    const id = requiredText(eventId, "eventId", 64);
    const event = await this.findEventById(null, id);

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME}
        WHERE id = ?
      `,
      [id],
    );

    return event;
  }

  async findEventById(reportId, eventId) {
    await this.ensureSchema();
    const params = [requiredText(eventId, "eventId", 64)];
    const where = ["event_item.id = ?"];

    if (reportId) {
      where.push("event_item.report_id = ?");
      params.push(requiredText(reportId, "reportId", 64));
    }

    const rows = await this.query(
      `
        ${baseEventSelect()}
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `,
      params,
    );

    return mapEventRow(readFirstRow(rows));
  }

  async findEventsByReportId(reportId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseEventSelect()}
        WHERE event_item.report_id = ?
        ORDER BY event_item.minute IS NULL,
                 event_item.minute ASC,
                 event_item.created_at ASC
      `,
      [requiredText(reportId, "reportId", 64)],
    );

    return readRows(rows).map(mapEventRow).filter(Boolean);
  }
}

function normalizeCreateReportInput(input = {}) {
  return {
    assistantReferee: nullableText(input.assistantReferee, 191),
    awayScore: normalizeScore(input.awayScore),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    homeScore: normalizeScore(input.homeScore),
    id: requiredText(input.id || createId("sumula"), "id", 64),
    matchId: requiredText(input.matchId, "matchId", 64),
    observations: nullableText(input.observations, 2000),
    referee: nullableText(input.referee, 191),
    scorer: nullableText(input.scorer, 191),
    status: text(input.status || ChampionshipMatchReportStatus.DRAFT, 32),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function normalizeCreateEventInput(input = {}) {
  return {
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    description: nullableText(input.description, 2000),
    eventType: requiredText(input.eventType, "eventType", 32),
    id: requiredText(input.id || createId("sumula-evento"), "id", 64),
    matchId: requiredText(input.matchId, "matchId", 64),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    minute: normalizeNullableInteger(input.minute),
    period: nullableText(input.period, 32),
    playerId: nullableText(input.playerId, 64),
    relatedPlayerId: nullableText(input.relatedPlayerId, 64),
    reportId: requiredText(input.reportId, "reportId", 64),
    teamRegistrationId: nullableText(input.teamRegistrationId, 64),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function baseReportSelect() {
  return `
    SELECT report.*
    FROM ${CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME} report
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

function baseEventSelect() {
  return `
    SELECT
      event_item.*,
      team.name AS team_name,
      team.acronym AS team_acronym,
      player.name AS player_name,
      player.shirt_number AS player_shirt_number,
      related_player.name AS related_player_name,
      related_player.shirt_number AS related_player_shirt_number
    FROM ${CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME} event_item
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
  `;
}

function mapReportRow(row) {
  if (!row) return null;

  return ChampionshipMatchReport.fromPersistence({
    assistant_referee: row.assistant_referee,
    away_score: row.away_score,
    championship_id: row.championship_id,
    created_at: row.created_at,
    created_by: row.created_by,
    finished_at: row.finished_at,
    home_score: row.home_score,
    id: row.id,
    match_id: row.match_id,
    observations: row.observations,
    referee: row.referee,
    scorer: row.scorer,
    started_at: row.started_at,
    status: row.status,
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
    status: row.status,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function mapEventRow(row) {
  if (!row) return null;

  return ChampionshipMatchEvent.fromPersistence({
    championship_id: row.championship_id,
    created_at: row.created_at,
    created_by: row.created_by,
    description: row.description,
    event_type: row.event_type,
    id: row.id,
    match_id: row.match_id,
    metadata: readObject(row.metadata_json),
    minute: row.minute,
    period: row.period,
    player_id: row.player_id,
    player_name: row.player_name,
    player_shirt_number: row.player_shirt_number,
    related_player_id: row.related_player_id,
    related_player_name: row.related_player_name,
    related_player_shirt_number: row.related_player_shirt_number,
    report_id: row.report_id,
    team_acronym: row.team_acronym,
    team_name: row.team_name,
    team_registration_id: row.team_registration_id,
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

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function normalizeNullableInteger(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toSqlDateTime(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  MySqlChampionshipMatchReportRepository,
};
