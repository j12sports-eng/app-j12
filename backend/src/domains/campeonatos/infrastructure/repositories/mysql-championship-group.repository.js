const { query, transaction } = require("../../../../config/db.js");
const {
  ChampionshipGroup,
  ChampionshipGroupRegistration,
} = require("../../domain/entities/index.js");
const {
  MySqlChampionshipRegistrationRepository,
} = require("./mysql-championship-registration.repository.js");
const {
  CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_GROUP_TABLE_NAME,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
} = require("../../shared/constants/index.js");
const {
  createId,
  nullableText,
  readFirstRow,
  readRows,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const GROUP_SORT_COLUMNS = Object.freeze({
  createdAt: "group_item.created_at",
  displayOrder: "group_item.display_order",
  name: "group_item.name",
});

class MySqlChampionshipGroupRepository {
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
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_GROUP_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        championship_id VARCHAR(64) NOT NULL,
        name VARCHAR(80) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_grupos_camp (championship_id),
        INDEX idx_j12_campeonato_grupos_ordem (championship_id, display_order),
        UNIQUE KEY uniq_j12_campeonato_grupos_nome (championship_id, name)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        group_id VARCHAR(64) NOT NULL,
        registration_id VARCHAR(64) NOT NULL,
        draw_position INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_j12_campeonato_grupo_insc_grupo (group_id),
        INDEX idx_j12_campeonato_grupo_insc_ordem (group_id, draw_position),
        UNIQUE KEY uniq_j12_campeonato_grupo_insc_insc (registration_id)
      )
    `);
  }

  async create(input = {}) {
    await this.ensureSchema();
    const values = normalizeCreateInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_GROUP_TABLE_NAME} (
          id,
          championship_id,
          name,
          display_order,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        values.id,
        values.championshipId,
        values.name,
        values.displayOrder,
        values.createdBy,
        values.updatedBy,
      ],
    );

    return this.findById(values.championshipId, values.id);
  }

  async update(championshipId, groupId, input = {}) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(groupId, "groupId", 64);
    const assignments = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(input, "name") && input.name !== undefined) {
      assignments.push("name = ?");
      params.push(requiredText(input.name, "name", 80));
    }

    if (
      Object.prototype.hasOwnProperty.call(input, "displayOrder") &&
      input.displayOrder !== undefined
    ) {
      assignments.push("display_order = ?");
      params.push(normalizeInteger(input.displayOrder));
    }

    if (assignments.length === 0) {
      return this.findById(campId, id);
    }

    assignments.push("updated_by = ?");
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    params.push(nullableText(input.updatedBy, 191));
    params.push(campId, id);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_GROUP_TABLE_NAME}
        SET ${assignments.join(", ")}
        WHERE championship_id = ?
          AND id = ?
      `,
      params,
    );

    return this.findById(campId, id);
  }

  async delete(championshipId, groupId) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const id = requiredText(groupId, "groupId", 64);
    const group = await this.findById(campId, id);

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_GROUP_TABLE_NAME}
        WHERE championship_id = ?
          AND id = ?
      `,
      [campId, id],
    );

    return group;
  }

  async findAllByChampionship(filters = {}) {
    await this.ensureSchema();
    const params = [requiredText(filters.championshipId, "championshipId", 64)];
    const where = ["group_item.championship_id = ?"];

    if (filters.search) {
      where.push("LOWER(group_item.name) LIKE ?");
      params.push(`%${String(filters.search).toLowerCase()}%`);
    }

    const totalRows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
        WHERE ${where.join(" AND ")}
      `,
      params,
    );
    const total = Number(readFirstRow(totalRows)?.total || 0);
    const limit = normalizeLimitValue(filters.limit);
    const page = normalizePageValue(filters.page);
    const orderColumn = GROUP_SORT_COLUMNS[filters.sortBy] || GROUP_SORT_COLUMNS.displayOrder;
    const orderDirection = filters.sortDirection === "DESC" ? "DESC" : "ASC";
    const rows = await this.query(
      `
        ${baseGroupSelect()}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, group_item.name ASC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, (page - 1) * limit],
    );
    const items = readRows(rows).map(mapGroupRow).filter(Boolean);

    await this.attachRegistrations(items);

    return {
      items,
      total,
    };
  }

  async findById(championshipId, groupId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseGroupSelect()}
        WHERE group_item.championship_id = ?
          AND group_item.id = ?
        LIMIT 1
      `,
      [requiredText(championshipId, "championshipId", 64), requiredText(groupId, "groupId", 64)],
    );
    const group = mapGroupRow(readFirstRow(rows));

    if (group) {
      await this.attachRegistrations([group]);
    }

    return group;
  }

  async findByName(championshipId, name) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseGroupSelect()}
        WHERE group_item.championship_id = ?
          AND LOWER(group_item.name) = ?
        LIMIT 1
      `,
      [
        requiredText(championshipId, "championshipId", 64),
        requiredText(name, "name", 80).toLowerCase(),
      ],
    );

    return mapGroupRow(readFirstRow(rows));
  }

  async countRegistrations(groupId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT COUNT(*) AS total
        FROM ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME}
        WHERE group_id = ?
      `,
      [requiredText(groupId, "groupId", 64)],
    );

    return Number(readFirstRow(rows)?.total || 0);
  }

  async addRegistration(input = {}) {
    await this.ensureSchema();
    const values = normalizeAssignmentInput(input);

    await this.query(
      `
        INSERT INTO ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} (
          id,
          group_id,
          registration_id,
          draw_position
        ) VALUES (?, ?, ?, ?)
      `,
      [values.id, values.groupId, values.registrationId, values.drawPosition],
    );

    return this.findAssignmentByRegistrationId(values.registrationId);
  }

  async removeRegistration(groupId, registrationId) {
    await this.ensureSchema();

    await this.query(
      `
        DELETE FROM ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME}
        WHERE group_id = ?
          AND registration_id = ?
      `,
      [requiredText(groupId, "groupId", 64), requiredText(registrationId, "registrationId", 64)],
    );
  }

  async moveRegistration(input = {}) {
    await this.ensureSchema();
    const targetGroupId = requiredText(input.targetGroupId, "targetGroupId", 64);
    const registrationId = requiredText(input.registrationId, "registrationId", 64);
    const drawPosition = normalizeInteger(input.drawPosition);

    await this.query(
      `
        UPDATE ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME}
        SET group_id = ?,
            draw_position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE registration_id = ?
      `,
      [targetGroupId, drawPosition, registrationId],
    );

    return this.findAssignmentByRegistrationId(registrationId);
  }

  async findAssignmentByRegistration(championshipId, registrationId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseAssignmentSelect()}
        WHERE group_item.championship_id = ?
          AND assignment.registration_id = ?
        LIMIT 1
      `,
      [
        requiredText(championshipId, "championshipId", 64),
        requiredText(registrationId, "registrationId", 64),
      ],
    );

    return mapAssignmentRow(readFirstRow(rows));
  }

  async listAssignmentsByChampionship(championshipId) {
    await this.ensureSchema();
    const rows = await this.query(
      `
        ${baseAssignmentSelect()}
        WHERE group_item.championship_id = ?
        ORDER BY group_item.display_order ASC, assignment.draw_position ASC
      `,
      [requiredText(championshipId, "championshipId", 64)],
    );

    return readRows(rows).map(mapAssignmentRow).filter(Boolean);
  }

  async clearAssignments(championshipId) {
    await this.ensureSchema();
    await this.query(
      `
        DELETE assignment
        FROM ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} assignment
        INNER JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
          ON group_item.id = assignment.group_id
        WHERE group_item.championship_id = ?
      `,
      [requiredText(championshipId, "championshipId", 64)],
    );
  }

  async replaceAssignments(championshipId, assignments = []) {
    await this.ensureSchema();
    const campId = requiredText(championshipId, "championshipId", 64);
    const work = async (executor) => {
      await runQuery(
        executor,
        `
          DELETE assignment
          FROM ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} assignment
          INNER JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
            ON group_item.id = assignment.group_id
          WHERE group_item.championship_id = ?
        `,
        [campId],
      );

      for (const assignment of assignments) {
        const values = normalizeAssignmentInput(assignment);
        await runQuery(
          executor,
          `
            INSERT INTO ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} (
              id,
              group_id,
              registration_id,
              draw_position
            ) VALUES (?, ?, ?, ?)
          `,
          [values.id, values.groupId, values.registrationId, values.drawPosition],
        );
      }
    };

    if (typeof this.transaction === "function") {
      await this.transaction(work);
    } else {
      await work(this.query);
    }
  }

  async findAssignmentByRegistrationId(registrationId) {
    const rows = await this.query(
      `
        ${baseAssignmentSelect()}
        WHERE assignment.registration_id = ?
        LIMIT 1
      `,
      [requiredText(registrationId, "registrationId", 64)],
    );

    return mapAssignmentRow(readFirstRow(rows));
  }

  async attachRegistrations(groups = []) {
    if (groups.length === 0) return;

    const ids = groups.map((group) => group.id).filter(Boolean);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = await this.query(
      `
        ${baseAssignmentSelect()}
        WHERE assignment.group_id IN (${placeholders})
        ORDER BY group_item.display_order ASC, assignment.draw_position ASC, team.name ASC
      `,
      ids,
    );
    const assignmentsByGroup = new Map();

    for (const assignment of readRows(rows).map(mapAssignmentRow).filter(Boolean)) {
      const current = assignmentsByGroup.get(assignment.groupId) || [];
      current.push(assignment);
      assignmentsByGroup.set(assignment.groupId, current);
    }

    for (const group of groups) {
      group.registrations = assignmentsByGroup.get(group.id) || [];
    }
  }
}

function normalizeCreateInput(input = {}) {
  return {
    championshipId: requiredText(input.championshipId, "championshipId", 64),
    createdBy: nullableText(input.createdBy, 191),
    displayOrder: normalizeInteger(input.displayOrder),
    id: nullableText(input.id, 64) || createId("grupo"),
    name: requiredText(input.name, "name", 80),
    updatedBy: nullableText(input.updatedBy, 191),
  };
}

function normalizeAssignmentInput(input = {}) {
  return {
    drawPosition: normalizeInteger(input.drawPosition),
    groupId: requiredText(input.groupId, "groupId", 64),
    id: nullableText(input.id, 64) || createId("grupo-insc"),
    registrationId: requiredText(input.registrationId, "registrationId", 64),
  };
}

function baseGroupSelect() {
  return `
    SELECT
      group_item.*
    FROM ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
  `;
}

function baseAssignmentSelect() {
  return `
    SELECT
      assignment.*,
      group_item.championship_id,
      registration.team_id,
      registration.status,
      team.name AS team_name,
      team.acronym AS team_acronym
    FROM ${CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME} assignment
    INNER JOIN ${CHAMPIONSHIP_GROUP_TABLE_NAME} group_item
      ON group_item.id = assignment.group_id
    INNER JOIN ${CHAMPIONSHIP_REGISTRATION_TABLE_NAME} registration
      ON registration.id = assignment.registration_id
      AND registration.deleted_at IS NULL
    LEFT JOIN ${CHAMPIONSHIP_TEAM_TABLE_NAME} team
      ON team.id = registration.team_id
  `;
}

function mapGroupRow(row) {
  if (!row) return null;

  return ChampionshipGroup.fromPersistence({
    championship_id: row.championship_id,
    created_at: row.created_at,
    created_by: row.created_by,
    display_order: row.display_order,
    id: row.id,
    name: row.name,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

function mapAssignmentRow(row) {
  if (!row) return null;

  return ChampionshipGroupRegistration.fromPersistence({
    championship_id: row.championship_id,
    created_at: row.created_at,
    draw_position: row.draw_position,
    group_id: row.group_id,
    id: row.id,
    registration_id: row.registration_id,
    status: text(row.status, 32),
    team_acronym: row.team_acronym,
    team_id: row.team_id,
    team_name: row.team_name,
    updated_at: row.updated_at,
  });
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 0) : 0;
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

  throw new Error("Executor SQL invalido para transacao de grupos.");
}

module.exports = {
  MySqlChampionshipGroupRepository,
};
