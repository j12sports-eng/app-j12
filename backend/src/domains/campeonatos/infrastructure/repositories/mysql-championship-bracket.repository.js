const { query, transaction } = require("../../../../config/db.js");
const { ChampionshipBracket, ChampionshipBracketMatch } = require("../../domain/entities/index.js");
const {
  CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME,
  CHAMPIONSHIP_BRACKET_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
  ChampionshipBracketStatus,
  ChampionshipMatchStatus,
} = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
} = require("../../shared/utils/index.js");
const {
  MySqlChampionshipRegistrationRepository,
} = require("./mysql-championship-registration.repository.js");

class MySqlChampionshipBracketRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.transaction = options.transactionRunner || options.transaction || transaction;
    this.registrationSchemaRepository =
      options.registrationSchemaRepository ||
      new MySqlChampionshipRegistrationRepository({
        queryRunner: this.query,
      });
  }

  async ensureSchema() {
    await this.registrationSchemaRepository.ensureSchema();
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_BRACKET_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        initial_phase VARCHAR(32) NOT NULL,
        display_order INT NOT NULL DEFAULT 1,
        status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        mode VARCHAR(32) NOT NULL DEFAULT 'AUTOMATIC',
        team_count INT NOT NULL DEFAULT 0,
        include_third_place TINYINT(1) NOT NULL DEFAULT 0,
        champion_registration_id VARCHAR(64) NULL,
        runner_up_registration_id VARCHAR(64) NULL,
        third_place_registration_id VARCHAR(64) NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_chave_camp (championship_id),
        INDEX idx_j12_campeonato_chave_status (championship_id, status)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        bracket_id VARCHAR(64) NOT NULL,
        championship_id VARCHAR(64) NOT NULL,
        phase VARCHAR(32) NOT NULL,
        display_order INT NOT NULL DEFAULT 1,
        round_order INT NOT NULL DEFAULT 1,
        home_registration_id VARCHAR(64) NULL,
        away_registration_id VARCHAR(64) NULL,
        winner_registration_id VARCHAR(64) NULL,
        next_match_id VARCHAR(64) NULL,
        next_match_slot VARCHAR(8) NULL,
        third_place_match_id VARCHAR(64) NULL,
        third_place_slot VARCHAR(8) NULL,
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
        INDEX idx_j12_campeonato_chave_jogos_camp (championship_id),
        INDEX idx_j12_campeonato_chave_jogos_chave (bracket_id),
        INDEX idx_j12_campeonato_chave_jogos_fase (championship_id, phase),
        INDEX idx_j12_campeonato_chave_jogos_status (championship_id, status)
      )
    `);
  }

  async replaceByChampionship(championshipId, bracketInput = {}, matches = []) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const bracket = normalizeBracketInput({ ...bracketInput, championshipId: campId });
    const work = async (executor) => {
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_BRACKET_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
      await runQuery(
        executor,
        `
          INSERT INTO ${CHAMPIONSHIP_BRACKET_TABLE_NAME} (
            id,
            championship_id,
            initial_phase,
            display_order,
            status,
            mode,
            team_count,
            include_third_place,
            champion_registration_id,
            runner_up_registration_id,
            third_place_registration_id,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          bracket.id,
          bracket.championshipId,
          bracket.initialPhase,
          bracket.displayOrder,
          bracket.status,
          bracket.mode,
          bracket.teamCount,
          bracket.includeThirdPlace ? 1 : 0,
          bracket.championRegistrationId,
          bracket.runnerUpRegistrationId,
          bracket.thirdPlaceRegistrationId,
          bracket.createdBy,
          bracket.updatedBy,
        ],
      );

      for (const match of matches) {
        const values = normalizeMatchInput({
          ...match,
          bracketId: bracket.id,
          championshipId: campId,
        });
        await runQuery(
          executor,
          `
            INSERT INTO ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME} (
              id,
              bracket_id,
              championship_id,
              phase,
              display_order,
              round_order,
              home_registration_id,
              away_registration_id,
              winner_registration_id,
              next_match_id,
              next_match_slot,
              third_place_match_id,
              third_place_slot,
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            values.id,
            values.bracketId,
            values.championshipId,
            values.phase,
            values.displayOrder,
            values.roundOrder,
            values.homeRegistrationId,
            values.awayRegistrationId,
            values.winnerRegistrationId,
            values.nextMatchId,
            values.nextMatchSlot,
            values.thirdPlaceMatchId,
            values.thirdPlaceSlot,
            values.matchDate,
            values.startTime,
            values.court,
            values.status,
            values.homeScore,
            values.awayScore,
            values.resultUpdatedBy,
            values.resultUpdatedAt,
            values.createdBy,
            values.updatedBy,
          ],
        );
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
    const rows = await this.query(
      `
        ${baseBracketSelect()}
        WHERE bracket.championship_id = ?
        ORDER BY bracket.created_at DESC
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64)],
    );
    const bracket = mapBracketRow(readFirstRow(rows));

    if (!bracket) return null;

    bracket.matches = await this.findMatchesByBracket(bracket.id);
    return bracket;
  }

  async findByPhase(championshipId, phase) {
    const bracket = await this.findByChampionship(championshipId);
    if (!bracket) return null;

    bracket.matches = bracket.matches.filter((match) => match.phase === phase);
    return bracket;
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

  async updateMatch(matchId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(matchId, "matchId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(
      assignments,
      params,
      input,
      "awayRegistrationId",
      "away_registration_id",
      (value) => nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "awayScore", "away_score", normalizeScore);
    pushAssignment(assignments, params, input, "court", "court", (value) =>
      nullableText(value, 120),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "homeRegistrationId",
      "home_registration_id",
      (value) => nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "homeScore", "home_score", normalizeScore);
    pushAssignment(assignments, params, input, "matchDate", "match_date", (value) =>
      nullableText(value, 32),
    );
    pushAssignment(assignments, params, input, "startTime", "start_time", (value) =>
      nullableText(value, 5),
    );
    pushAssignment(assignments, params, input, "status", "status", (value) =>
      requiredText(value, "status", 32),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "winnerRegistrationId",
      "winner_registration_id",
      (value) => nullableText(value, 64),
    );

    if (hasResultFields(input)) {
      assignments.push("result_updated_by = ?");
      params.push(nullableText(input.updatedBy, 191));
      assignments.push("result_updated_at = CURRENT_TIMESTAMP");
    }

    assignments.push("updated_by = ?");
    params.push(nullableText(input.updatedBy, 191));

    if (assignments.length === 1) return this.findMatchById(id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      [...params, id],
    );

    return this.findMatchById(id);
  }

  async updateBracket(bracketId, input = {}) {
    await this.ensureSchema();
    const id = requiredText(bracketId, "bracketId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(
      assignments,
      params,
      input,
      "championRegistrationId",
      "champion_registration_id",
      (value) => nullableText(value, 64),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "runnerUpRegistrationId",
      "runner_up_registration_id",
      (value) => nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "status", "status", (value) =>
      requiredText(value, "status", 32),
    );
    pushAssignment(
      assignments,
      params,
      input,
      "thirdPlaceRegistrationId",
      "third_place_registration_id",
      (value) => nullableText(value, 64),
    );
    assignments.push("updated_by = ?");
    params.push(nullableText(input.updatedBy, 191));

    if (assignments.length === 1) {
      return this.findByBracketId(id);
    }

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_BRACKET_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      [...params, id],
    );

    return this.findByBracketId(id);
  }

  async deleteByChampionship(championshipId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const bracket = await this.findByChampionship(campId);

    if (!bracket) return null;

    const work = async (executor) => {
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
      await runQuery(
        executor,
        `
          DELETE FROM ${CHAMPIONSHIP_BRACKET_TABLE_NAME}
          WHERE championship_id = ?
        `,
        [campId],
      );
    };

    if (typeof this.transaction === "function") {
      await this.transaction(work);
    } else {
      await work(this.query);
    }

    return bracket;
  }

  async hasStarted(championshipId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME}
        WHERE championship_id = ?
          AND (
            status <> ?
            OR home_score IS NOT NULL
            OR away_score IS NOT NULL
            OR winner_registration_id IS NOT NULL
          )
      `,
      [requiredText(championshipId, "championshipId", 64), ChampionshipMatchStatus.SCHEDULED],
    );

    return Number(readFirstRow(rows)?.total || 0) > 0;
  }

  async findByBracketId(bracketId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseBracketSelect()}
        WHERE bracket.id = ?
        LIMIT 1
      `,
      [requiredText(bracketId, "bracketId", 64)],
    );
    const bracket = mapBracketRow(readFirstRow(rows));

    if (!bracket) return null;

    bracket.matches = await this.findMatchesByBracket(bracket.id);
    return bracket;
  }

  async findMatchesByBracket(bracketId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseMatchSelect()}
        WHERE match_item.bracket_id = ?
        ORDER BY match_item.round_order ASC, match_item.display_order ASC
      `,
      [requiredText(bracketId, "bracketId", 64)],
    );

    return readRows(rows).map(mapMatchRow).filter(Boolean);
  }
}

function baseBracketSelect() {
  return `
    SELECT
      bracket.*
    FROM ${CHAMPIONSHIP_BRACKET_TABLE_NAME} bracket
  `;
}

function baseMatchSelect() {
  return `
    SELECT
      match_item.*,
      home_registration.team_id AS home_team_id,
      home_team.name AS home_team_name,
      home_team.acronym AS home_team_acronym,
      away_registration.team_id AS away_team_id,
      away_team.name AS away_team_name,
      away_team.acronym AS away_team_acronym,
      winner_registration.team_id AS winner_team_id,
      winner_team.name AS winner_team_name,
      winner_team.acronym AS winner_team_acronym
    FROM ${CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME} match_item
    LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} home_registration
      ON home_registration.id = match_item.home_registration_id
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} home_team
      ON home_team.id = home_registration.team_id
    LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} away_registration
      ON away_registration.id = match_item.away_registration_id
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} away_team
      ON away_team.id = away_registration.team_id
    LEFT JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} winner_registration
      ON winner_registration.id = match_item.winner_registration_id
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} winner_team
      ON winner_team.id = winner_registration.team_id
  `;
}

function mapBracketRow(row) {
  if (!row) return null;

  return ChampionshipBracket.fromPersistence({
    champion_registration_id: row.champion_registration_id,
    championship_id: row.championship_id,
    created_at: row.created_at,
    created_by: row.created_by,
    display_order: row.display_order,
    id: row.id,
    include_third_place: Boolean(row.include_third_place),
    initial_phase: row.initial_phase,
    mode: row.mode,
    runner_up_registration_id: row.runner_up_registration_id,
    status: row.status || ChampionshipBracketStatus.DRAFT,
    team_count: row.team_count,
    third_place_registration_id: row.third_place_registration_id,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function mapMatchRow(row) {
  if (!row) return null;

  return ChampionshipBracketMatch.fromPersistence({
    away_registration_id: row.away_registration_id,
    away_score: row.away_score,
    away_team_acronym: row.away_team_acronym,
    away_team_id: row.away_team_id,
    away_team_name: row.away_team_name,
    bracket_id: row.bracket_id,
    championship_id: row.championship_id,
    court: row.court,
    created_at: row.created_at,
    created_by: row.created_by,
    display_order: row.display_order,
    home_registration_id: row.home_registration_id,
    home_score: row.home_score,
    home_team_acronym: row.home_team_acronym,
    home_team_id: row.home_team_id,
    home_team_name: row.home_team_name,
    id: row.id,
    match_date: row.match_date,
    next_match_id: row.next_match_id,
    next_match_slot: row.next_match_slot,
    phase: row.phase,
    result_updated_at: row.result_updated_at,
    result_updated_by: row.result_updated_by,
    round_order: row.round_order,
    start_time: row.start_time,
    status: row.status,
    third_place_match_id: row.third_place_match_id,
    third_place_slot: row.third_place_slot,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    winner_registration_id: row.winner_registration_id,
    winner_team_acronym: row.winner_team_acronym,
    winner_team_id: row.winner_team_id,
    winner_team_name: row.winner_team_name,
  });
}

function normalizeBracketInput(input = {}) {
  return {
    championRegistrationId: nullableText(input.championRegistrationId, 64),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    displayOrder: normalizeNumber(input.displayOrder || 1),
    id: nullableText(input.id, 64) || createId("chave"),
    includeThirdPlace: Boolean(input.includeThirdPlace),
    initialPhase: requiredText(input.initialPhase, "initialPhase", 32),
    mode: requiredText(input.mode, "mode", 32),
    runnerUpRegistrationId: nullableText(input.runnerUpRegistrationId, 64),
    status: requiredText(input.status || ChampionshipBracketStatus.READY, "status", 32),
    teamCount: normalizeNumber(input.teamCount),
    thirdPlaceRegistrationId: nullableText(input.thirdPlaceRegistrationId, 64),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function normalizeMatchInput(input = {}) {
  return {
    awayRegistrationId: nullableText(input.awayRegistrationId, 64),
    awayScore: normalizeScore(input.awayScore),
    bracketId: requiredText(input.bracketId, "bracketId", 64),
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    court: nullableText(input.court, 120),
    createdBy: nullableText(input.createdBy, 191),
    displayOrder: normalizeNumber(input.displayOrder || 1),
    homeRegistrationId: nullableText(input.homeRegistrationId, 64),
    homeScore: normalizeScore(input.homeScore),
    id: nullableText(input.id, 64) || createId("chave-jogo"),
    matchDate: nullableText(input.matchDate, 32),
    nextMatchId: nullableText(input.nextMatchId, 64),
    nextMatchSlot: nullableText(input.nextMatchSlot, 8),
    phase: requiredText(input.phase, "phase", 32),
    resultUpdatedAt: input.resultUpdatedAt || null,
    resultUpdatedBy: nullableText(input.resultUpdatedBy, 191),
    roundOrder: normalizeNumber(input.roundOrder || 1),
    startTime: nullableText(input.startTime, 5),
    status: requiredText(input.status || ChampionshipMatchStatus.SCHEDULED, "status", 32),
    thirdPlaceMatchId: nullableText(input.thirdPlaceMatchId, 64),
    thirdPlaceSlot: nullableText(input.thirdPlaceSlot, 8),
    updatedBy: nullableText(input.updatedBy, 191),
    winnerRegistrationId: nullableText(input.winnerRegistrationId, 64),
  };
}

function pushAssignment(assignments, params, input, property, column, normalizer) {
  if (!Object.prototype.hasOwnProperty.call(input, property)) return;

  assignments.push(`${column} = ?`);
  params.push(normalizer(input[property]));
}

function hasResultFields(input = {}) {
  return (
    Object.prototype.hasOwnProperty.call(input, "awayScore") ||
    Object.prototype.hasOwnProperty.call(input, "homeScore") ||
    Object.prototype.hasOwnProperty.call(input, "status") ||
    Object.prototype.hasOwnProperty.call(input, "winnerRegistrationId")
  );
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
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

  throw new Error("Executor SQL invalido para transacao de mata-mata.");
}

module.exports = {
  MySqlChampionshipBracketRepository,
};
