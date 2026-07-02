const TABLE_NAME = "j12_turmas";

const SELECT_CLASS_BY_ID_SQL = `
  SELECT
    turma.id,
    turma.nome,
    turma.status,
    turma.capacidade,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_nome,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at,
    turma.updated_at
  FROM ${TABLE_NAME} turma
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE turma.id = ?
  LIMIT 1
`;

const SELECT_CLASS_CAPACITY_SNAPSHOT_SQL = `
  SELECT
    turma.id,
    turma.nome,
    turma.status,
    turma.capacidade,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_nome,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at,
    turma.updated_at,
    (
      SELECT COUNT(DISTINCT aluno.id)
      FROM j12_alunos aluno
      WHERE aluno.turma_id = turma.id
         OR aluno.turma_principal = turma.nome
    ) AS current_student_count
  FROM ${TABLE_NAME} turma
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE turma.id = ?
  LIMIT 1
`;

const SELECT_CLASS_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL = `
  ${SELECT_CLASS_CAPACITY_SNAPSHOT_SQL.trim()}
  FOR UPDATE
`;

const SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_SQL = `
  SELECT
    turma.id,
    turma.nome,
    turma.status,
    turma.capacidade,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_nome,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at,
    turma.updated_at,
    (
      SELECT COUNT(DISTINCT link.enrollment_id)
      FROM enrollment_class_links link
      WHERE link.class_id = turma.id
        AND link.status = 'ACTIVE'
        AND link.unlinked_at IS NULL
    ) AS current_student_count
  FROM ${TABLE_NAME} turma
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE turma.id = ?
  LIMIT 1
`;

const SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL = `
  ${SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_SQL.trim()}
  FOR UPDATE
`;

/**
 * MySQL read-only repository for the Classes/Turmas domain.
 *
 * This adapter only executes SELECT statements against existing J12 tables. It
 * does not create, update or delete Turmas, students, schedules or enrollments.
 */
class MySqlClassRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findById(input = {}) {
    const classId = requiredInteger(input.classId, "classId");
    const rows = await this.query(SELECT_CLASS_BY_ID_SQL, [classId]);

    return toClassData(readFirstRow(rows));
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findActiveById(input = {}) {
    const classRecord = await this.findById(input);

    if (!classRecord || !classRecord.active) {
      return null;
    }

    return classRecord;
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async getClassCapacitySnapshot(input = {}) {
    const classId = requiredInteger(input.classId, "classId");
    const useEnrollmentClassLinks =
      nullableText(input.occupancySource, 64) === "enrollment_class_links";
    const rows = await this.query(
      selectCapacitySnapshotSql({
        lockForUpdate: input.lockForUpdate === true,
        useEnrollmentClassLinks,
      }),
      [classId],
    );
    const row = readFirstRow(rows);
    const classRecord = toClassData(row);

    if (!classRecord) {
      return null;
    }

    return {
      capacity: classRecord.capacity,
      capacitySource: useEnrollmentClassLinks
        ? "j12_turmas.capacidade + active enrollment_class_links"
        : "j12_turmas.capacidade + active j12_alunos links",
      classId,
      classRecord,
      currentStudentCount: normalizeOptionalInteger(row?.current_student_count),
      lockForUpdate: input.lockForUpdate === true,
      occupancySource: useEnrollmentClassLinks ? "enrollment_class_links" : "j12_alunos",
      studentCountSource: useEnrollmentClassLinks
        ? "enrollment_class_links ACTIVE links"
        : "j12_alunos.turma_id OR j12_alunos.turma_principal",
    };
  }
}

/**
 * @param {{ lockForUpdate?: boolean, useEnrollmentClassLinks?: boolean }} input
 * @returns {string}
 */
function selectCapacitySnapshotSql({ lockForUpdate = false, useEnrollmentClassLinks = false } = {}) {
  if (useEnrollmentClassLinks) {
    return lockForUpdate
      ? SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL
      : SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_SQL;
  }

  return lockForUpdate
    ? SELECT_CLASS_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL
    : SELECT_CLASS_CAPACITY_SNAPSHOT_SQL;
}

/**
 * @param {Record<string, unknown>|null} row
 * @returns {Record<string, unknown>|null}
 */
function toClassData(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    active: normalizeActive(row.status),
    capacity: normalizeOptionalInteger(row.capacidade),
    classId: normalizeOptionalInteger(row.id),
    createdAt: row.created_at ?? null,
    daysOfWeek: parseJsonArray(row.dias_semana_json, row.dias_semana),
    endTime: nullableText(row.horario_fim, 20),
    id: row.id == null ? null : String(row.id),
    modality: nullableText(row.modalidade, 191),
    modalityId: row.modalidade_id == null ? null : String(row.modalidade_id),
    name: nullableText(row.nome, 191),
    professorId: row.professor_id == null ? null : String(row.professor_id),
    professorName: nullableText(row.professor_nome, 191),
    rawStatus: nullableText(row.status, 32),
    startTime: nullableText(row.horario_inicio ?? row.horario, 20),
    status: nullableText(row.status, 32),
    unit: nullableText(row.unidade, 191),
    unitId: row.unidade_id == null ? null : String(row.unidade_id),
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Accepts both the project query wrapper shape (`rows`) and mysql2
 * connection.execute shape (`[rows, fields]`).
 *
 * @param {unknown} result
 * @returns {Record<string, unknown>|null}
 */
function readFirstRow(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];

  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function normalizeActive(value) {
  const normalized = nullableText(value, 32)?.toLowerCase();

  if (["inativa", "inativo", "inactive", "false", "0"].includes(normalized || "")) {
    return false;
  }

  return true;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeOptionalInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.trunc(parsed));
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requiredInteger(value, field) {
  const parsed = normalizeOptionalInteger(value);

  if (!parsed || parsed <= 0) {
    throw new TypeError(`MySqlClassRepository requires ${field}.`);
  }

  return parsed;
}

/**
 * @param {unknown} value
 * @param {unknown} fallback
 * @returns {string[]}
 */
function parseJsonArray(value, fallback = null) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  try {
    const parsed = JSON.parse(String(value ?? ""));

    if (Array.isArray(parsed)) {
      return uniqueStrings(parsed);
    }
  } catch {
    // Fall back to the legacy slash/comma separated column.
  }

  return uniqueStrings(
    String(fallback ?? "")
      .replace(/\./g, "")
      .split(/[\/,;|]/g),
  );
}

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

/**
 * Loads the current mysql2 query wrapper lazily to avoid database side effects
 * when the domain is imported for architecture discovery or tests.
 *
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  CLASSES_TABLE_NAME: TABLE_NAME,
  MySqlClassRepository,
  SELECT_CLASS_BY_ID_SQL,
  SELECT_CLASS_CAPACITY_SNAPSHOT_SQL,
  SELECT_CLASS_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL,
  SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_SQL,
  SELECT_CLASS_LINK_CAPACITY_SNAPSHOT_FOR_UPDATE_SQL,
  normalizeActive,
  readFirstRow,
  selectCapacitySnapshotSql,
  toClassData,
};
