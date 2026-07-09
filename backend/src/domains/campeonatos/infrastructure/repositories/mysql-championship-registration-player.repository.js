const { query, transaction } = require("../../../../config/db.js");
const { ChampionshipRegistrationPlayer } = require("../../domain/entities/index.js");
const { CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME } = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const PLAYER_SORT_COLUMNS = Object.freeze({
  createdAt: "player.created_at",
  name: "player.name",
  position: "player.position",
  shirtNumber: "player.shirt_number",
  updatedAt: "player.updated_at",
});

class MySqlChampionshipRegistrationPlayerRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || options.query || query;
    this.transaction = options.transactionRunner || options.transaction || transaction;
  }

  async ensureSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        registration_id VARCHAR(64) NOT NULL,
        athlete_id VARCHAR(64) NULL,
        name VARCHAR(191) NOT NULL,
        birth_date DATE NULL,
        document VARCHAR(64) NULL,
        shirt_number INT NOT NULL,
        position VARCHAR(80) NULL,
        captain TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_insc_atletas_inscricao (registration_id),
        INDEX idx_j12_campeonato_insc_atletas_camisa (registration_id, shirt_number, active),
        INDEX idx_j12_campeonato_insc_atletas_capitao (registration_id, captain, active),
        INDEX idx_j12_campeonato_insc_atletas_atleta (athlete_id),
        INDEX idx_j12_campeonato_insc_atletas_status (active),
        INDEX idx_j12_campeonato_insc_atletas_nome (name)
      )
    `);
  }

  async create(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} (
          id,
          registration_id,
          athlete_id,
          name,
          birth_date,
          document,
          shirt_number,
          position,
          captain,
          active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.registrationId,
        values.athleteId,
        values.name,
        values.birthDate,
        values.document,
        values.shirtNumber,
        values.position,
        values.captain ? 1 : 0,
        values.active ? 1 : 0,
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findByRegistrationAndId(values.registrationId, values.id);
  }

  async update(registrationId, playerId, input = {}) {
    await this.ensureSchema();
    const registration = requiredText(registrationId, "registrationId", 64);
    const id = requiredText(playerId, "playerId", 64);
    const assignments = [];
    const params = [];

    pushAssignment(assignments, params, input, "athleteId", "athlete_id", (value) =>
      nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "birthDate", "birth_date", (value) =>
      nullableText(value, 32),
    );
    pushAssignment(assignments, params, input, "document", "document", (value) =>
      nullableText(value, 64),
    );
    pushAssignment(assignments, params, input, "name", "name", (value) =>
      requiredText(value, "name", 191),
    );
    pushAssignment(assignments, params, input, "position", "position", (value) =>
      nullableText(value, 80),
    );
    pushAssignment(assignments, params, input, "shirtNumber", "shirt_number", normalizeShirtNumber);

    if (Object.prototype.hasOwnProperty.call(input, "captain")) {
      assignments.push("captain = ?");
      params.push(input.captain ? 1 : 0);
    }

    if (Object.prototype.hasOwnProperty.call(input, "active")) {
      assignments.push("active = ?");
      params.push(input.active ? 1 : 0);
    }

    if (assignments.length === 0) {
      return this.findByRegistrationAndId(registration, id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191));
    params.push(registration, id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE registration_id = ?
          AND id = ?
      `,
      params,
    );

    return this.findByRegistrationAndId(registration, id);
  }

  async deactivate(registrationId, playerId, input = {}) {
    await this.ensureSchema();
    const registration = requiredText(registrationId, "registrationId", 64);
    const id = requiredText(playerId, "playerId", 64);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
        SET active = 0,
            captain = 0,
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE registration_id = ?
          AND id = ?
      `,
      [nullableText(input.updatedBy, 191), registration, id],
    );

    return this.findByRegistrationAndId(registration, id);
  }

  async findByRegistrationAndId(registrationId, playerId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${basePlayerSelect()}
        WHERE player.registration_id = ?
          AND player.id = ?
        LIMIT 1
      `,
      [requiredText(registrationId, "registrationId", 64), requiredText(playerId, "playerId", 64)],
    );

    return mapPlayerRow(readFirstRow(rows));
  }

  async findByRegistrationAndShirtNumber(registrationId, shirtNumber, ignoredPlayerId = null) {
    await this.ensureSchema();
    const params = [
      requiredText(registrationId, "registrationId", 64),
      normalizeShirtNumber(shirtNumber),
    ];
    const where = ["player.registration_id = ?", "player.shirt_number = ?", "player.active = 1"];

    if (ignoredPlayerId) {
      where.push("player.id <> ?");
      params.push(requiredText(ignoredPlayerId, "ignoredPlayerId", 64));
    }

    const rows = await this.query(
      `
        ${basePlayerSelect()}
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `,
      params,
    );

    return mapPlayerRow(readFirstRow(rows));
  }

  async findCaptainByRegistration(registrationId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${basePlayerSelect()}
        WHERE player.registration_id = ?
          AND player.captain = 1
          AND player.active = 1
        LIMIT 1
      `,
      [requiredText(registrationId, "registrationId", 64)],
    );

    return mapPlayerRow(readFirstRow(rows));
  }

  async findAllByRegistration(registrationId, filters = {}) {
    await this.ensureSchema();
    const registration = requiredText(registrationId, "registrationId", 64);
    const params = [registration];
    const where = ["player.registration_id = ?"];

    if (typeof filters.active === "boolean") {
      where.push("player.active = ?");
      params.push(filters.active ? 1 : 0);
    }

    if (filters.position) {
      where.push("LOWER(player.position) = ?");
      params.push(String(filters.position).toLowerCase());
    }

    if (filters.search) {
      where.push(
        "(LOWER(player.name) LIKE ? OR LOWER(player.document) LIKE ? OR LOWER(player.position) LIKE ? OR CAST(player.shirt_number AS CHAR) LIKE ?)",
      );
      const search = `%${String(filters.search).toLowerCase()}%`;
      params.push(search, search, search, search);
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} player
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn = PLAYER_SORT_COLUMNS[filters.sortBy] || PLAYER_SORT_COLUMNS.shirtNumber;
    const orderDirection = filters.sortDirection === "DESC" ? "DESC" : "ASC";

    const rows = await this.query(
      `
        ${basePlayerSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, player.name ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );

    return {
      items: readRows(rows).map(mapPlayerRow).filter(Boolean),
      total,
    };
  }

  async setCaptain(registrationId, playerId, input = {}) {
    await this.ensureSchema();
    const registration = requiredText(registrationId, "registrationId", 64);
    const id = requiredText(playerId, "playerId", 64);
    const captain = input.captain !== false;
    const updatedBy = nullableText(input.updatedBy, 191);

    if (captain && typeof this.transaction === "function") {
      await this.transaction(async (connection) => {
        await runQuery(
          connection,
          `
            UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
            SET captain = 0,
                updated_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE registration_id = ?
              AND active = 1
          `,
          [updatedBy, registration],
        );
        await runQuery(
          connection,
          `
            UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
            SET captain = 1,
                updated_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE registration_id = ?
              AND id = ?
              AND active = 1
          `,
          [updatedBy, registration, id],
        );
      });
    } else if (captain) {
      await this.query(
        `
          UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
          SET captain = 0,
              updated_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE registration_id = ?
            AND active = 1
        `,
        [updatedBy, registration],
      );
      await this.query(
        `
          UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
          SET captain = 1,
              updated_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE registration_id = ?
            AND id = ?
            AND active = 1
        `,
        [updatedBy, registration, id],
      );
    } else {
      await this.query(
        `
          UPDATE ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME}
          SET captain = 0,
              updated_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE registration_id = ?
            AND id = ?
        `,
        [updatedBy, registration, id],
      );
    }

    return this.findByRegistrationAndId(registration, id);
  }
}

function normalizeCreateInput(input = {}) {
  return {
    active: input.active !== false,
    athleteId: nullableText(input.athleteId, 64),
    birthDate: nullableText(input.birthDate, 32),
    captain: Boolean(input.captain),
    createdBy: nullableText(input.createdBy, 191),
    document: nullableText(input.document, 64),
    id: nullableText(input.id, 64) || createId("atl"),
    name: requiredText(input.name, "name", 191),
    position: nullableText(input.position, 80),
    registrationId: requiredText(input.registrationId, "registrationId", 64),
    shirtNumber: normalizeShirtNumber(input.shirtNumber),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function basePlayerSelect() {
  return `
    SELECT
      player.*
    FROM ${CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME} player
  `;
}

function mapPlayerRow(row) {
  if (!row) return null;

  return ChampionshipRegistrationPlayer.fromPersistence({
    active: Number(row.active ?? 1) === 1,
    athlete_id: row.athlete_id,
    birth_date: row.birth_date,
    captain: Number(row.captain || 0) === 1,
    created_at: row.created_at,
    created_by: row.created_by,
    document: row.document,
    id: row.id,
    name: row.name,
    position: text(row.position, 80),
    registration_id: row.registration_id,
    shirt_number: row.shirt_number,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function pushAssignment(assignments, params, input, sourceField, columnName, normalize) {
  if (!Object.prototype.hasOwnProperty.call(input, sourceField)) return;

  assignments.push(`${columnName} = ?`);
  params.push(normalize(input[sourceField]));
}

function normalizeShirtNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
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

  throw new Error("Executor SQL invalido para transacao de atletas.");
}

module.exports = {
  MySqlChampionshipRegistrationPlayerRepository,
};
