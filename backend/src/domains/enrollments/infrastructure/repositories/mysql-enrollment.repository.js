const { createHash, randomUUID } = require("node:crypto");

const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");

const TABLE_NAME = "enrollments";
const ACTIVE_DRAFT_UNIQUE_INDEX_NAME = "ux_enrollments_active_draft_student_profile";
const DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE = "DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const INSERT_ENROLLMENT_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    student_person_id,
    student_profile_id,
    status,
    start_date,
    end_date,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?)
`;

const SELECT_ENROLLMENT_BY_ID_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND student_person_id = ?
    AND student_profile_id = ?
  ORDER BY confirmed_at DESC, updated_at DESC, created_at DESC, id DESC
  LIMIT 1
`;

const UPDATE_ENROLLMENT_STATUS_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      confirmed_at = CASE
        WHEN ? = ? THEN COALESCE(?, CURRENT_TIMESTAMP)
        ELSE confirmed_at
      END,
      confirmed_by = CASE
        WHEN ? = ? THEN ?
        ELSE confirmed_by
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
  LIMIT 1
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND student_person_id = ?
    AND student_profile_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND student_person_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL = `
  SELECT *
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND student_profile_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SEARCH_ENROLLMENT_STUDENT_SCOPES_SQL = `
  SELECT
    person.id AS student_person_id,
    profile.id AS student_profile_id,
    person.nome AS student_name,
    person.cpf AS student_cpf,
    person.email AS student_email,
    COALESCE(person.celular, person.telefone) AS student_phone,
    profile.status AS profile_status,
    MAX(CASE WHEN enrollment.status = ? AND enrollment.deleted_at IS NULL THEN 1 ELSE 0 END) AS has_draft_enrollment,
    MAX(CASE WHEN enrollment.status = ? AND enrollment.deleted_at IS NULL THEN 1 ELSE 0 END) AS has_active_enrollment,
    MAX(enrollment.updated_at) AS last_enrollment_at
  FROM person_profiles profile
  INNER JOIN people person
    ON person.id = profile.person_id
  LEFT JOIN ${TABLE_NAME} enrollment
    ON enrollment.student_person_id = profile.person_id
   AND enrollment.student_profile_id = profile.id
   AND enrollment.deleted_at IS NULL
  WHERE profile.profile_type = 'aluno'
    AND (
      person.nome LIKE ? ESCAPE '\\\\'
      OR person.cpf LIKE ? ESCAPE '\\\\'
      OR REPLACE(REPLACE(REPLACE(REPLACE(person.cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ? ESCAPE '\\\\'
      OR person.email LIKE ? ESCAPE '\\\\'
      OR person.id = ?
      OR profile.id = ?
    )
  GROUP BY
    person.id,
    profile.id,
    person.nome,
    person.cpf,
    person.email,
    person.celular,
    person.telefone,
    profile.status
  ORDER BY
    has_active_enrollment DESC,
    has_draft_enrollment DESC,
    last_enrollment_at DESC,
    person.nome ASC
  LIMIT ?
`;

const DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS = 10;
const DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE = "DRAFT_ENROLLMENT_LOCK_TIMEOUT";
const DRAFT_ENROLLMENT_LOCK_FAILED_CODE = "DRAFT_ENROLLMENT_LOCK_FAILED";
const DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED_CODE = "DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED";
const GET_DRAFT_ENROLLMENT_LOCK_SQL = "SELECT GET_LOCK(?, ?) AS locked";
const RELEASE_DRAFT_ENROLLMENT_LOCK_SQL = "SELECT RELEASE_LOCK(?) AS released";

/**
 * MySQL repository for Enrollment persistence.
 *
 * This repository only encapsulates SQL for the `enrollments` table. It is not
 * wired into the current enrollment flow and does not execute migrations.
 */
class MySqlEnrollmentRepository {
  /**
   * @param {Object} [options]
   * @param {{ error?: (message: string, context?: Record<string, unknown>) => void, info?: (message: string, context?: Record<string, unknown>) => void, warn?: (message: string, context?: Record<string, unknown>) => void }} [options.logger]
   * @param {number} [options.lockTimeoutSeconds]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({
    logger = console,
    lockTimeoutSeconds = DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS,
    queryRunner = null,
  } = {}) {
    this.logger = logger;
    this.lockTimeoutSeconds = normalizeLockTimeoutSeconds(lockTimeoutSeconds);
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * Creates an Enrollment row.
   *
   * @param {import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>} enrollment
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async create(enrollment) {
    const input = toEnrollmentData(enrollment);
    const id = nullableText(input.id, 64) || randomUUID();
    const values = toEnrollmentRowValues({ ...input, id });

    await this.query(INSERT_ENROLLMENT_SQL, [
      values.id,
      values.student_person_id,
      values.student_profile_id,
      values.status,
      values.start_date,
      values.end_date,
      values.created_at,
      values.updated_at,
      values.deleted_at,
    ]);

    const rows = await this.query(SELECT_ENROLLMENT_BY_ID_SQL, [id]);
    const row = readFirstRow(rows) || values;

    return toEnrollmentDataFromRow(row);
  }

  /**
   * Finds an Enrollment by aggregate id.
   *
   * @param {string} id
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findById(id) {
    const enrollmentId = requiredText(id, "id", 64);
    const rows = await this.query(SELECT_ENROLLMENT_BY_ID_SQL, [enrollmentId]);

    return toEnrollmentDataFromRow(readFirstRow(rows));
  }

  /**
   * Finds the latest persisted ACTIVE Enrollment for a student/profile pair.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findActiveByStudent({ studentPersonId = null, studentProfileId = null } = {}) {
    const personId = nullableText(studentPersonId, 64);
    const profileId = nullableText(studentProfileId, 64);

    if (!personId || !profileId) {
      return null;
    }

    const rows = await this.query(SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL, [
      EnrollmentStatus.ACTIVE,
      personId,
      profileId,
    ]);

    return toEnrollmentDataFromRow(readFirstRow(rows));
  }

  /**
   * Updates Enrollment status and confirmation audit fields when activating.
   *
   * @param {string} id
   * @param {string} status
   * @param {{ confirmedAt?: string|null, confirmedBy?: string|null }} [options]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async updateStatus(id, status, { confirmedAt = null, confirmedBy = null } = {}) {
    const enrollmentId = requiredText(id, "id", 64);
    const normalizedStatus = normalizeEnrollmentStatus(status);

    if (!normalizedStatus) {
      throw new TypeError("MySqlEnrollmentRepository.updateStatus requires a valid status.");
    }

    await this.query(UPDATE_ENROLLMENT_STATUS_SQL, [
      normalizedStatus,
      normalizedStatus,
      EnrollmentStatus.ACTIVE,
      nullableText(confirmedAt, 32),
      normalizedStatus,
      EnrollmentStatus.ACTIVE,
      nullableText(confirmedBy, 191),
      enrollmentId,
    ]);

    return this.findById(enrollmentId);
  }

  /**
   * Creates a DRAFT Enrollment only when one does not already exist for the
   * student/profile pair. A MySQL named lock serializes concurrent attempts
   * without requiring a schema change.
   *
   * @param {import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>} enrollment
   * @returns {Promise<{ enrollment: Record<string, unknown>|null, created: boolean, reused: boolean }>}
   */
  async createDraftIfNotExists(enrollment) {
    const input = toEnrollmentData(enrollment);
    const id = nullableText(input.id, 64) || randomUUID();
    const values = toEnrollmentRowValues({ ...input, id, status: EnrollmentStatus.DRAFT });
    const lockName = buildDraftEnrollmentLockName(values);
    let lockAcquired = false;
    let operationError = null;

    try {
      await this.acquireDraftEnrollmentLock(lockName);
      lockAcquired = true;
      this.logInfo("[enrollments] Draft Enrollment idempotency lock acquired.", {
        lockName,
        studentPersonId: values.student_person_id,
        studentProfileId: values.student_profile_id,
      });

      const existingEnrollment = await this.findDraftByStudent({
        studentPersonId: values.student_person_id,
        studentProfileId: values.student_profile_id,
      });

      if (existingEnrollment) {
        this.logInfo("[enrollments] Reusing existing draft Enrollment inside idempotency lock.", {
          enrollmentId: existingEnrollment.id ?? null,
          lockName,
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
        });

        return {
          created: false,
          enrollment: existingEnrollment,
          reused: true,
        };
      }

      try {
        const createdEnrollment = await this.create({
          ...input,
          id,
          status: EnrollmentStatus.DRAFT,
        });
        this.logInfo("[enrollments] Created new draft Enrollment inside idempotency lock.", {
          enrollmentId: createdEnrollment?.id ?? null,
          lockName,
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
        });

        return {
          created: true,
          enrollment: createdEnrollment,
          reused: false,
        };
      } catch (createError) {
        if (!isActiveDraftDuplicateEntryError(createError)) {
          throw createError;
        }

        const recoveredEnrollment = await this.findDraftByStudent({
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
        });

        if (!recoveredEnrollment) {
          this.logWarn(
            "[enrollments] Draft Enrollment duplicate constraint hit, but no reusable draft was found.",
            {
              code: createError?.code ?? DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE,
              errno: createError?.errno ?? null,
              indexName: ACTIVE_DRAFT_UNIQUE_INDEX_NAME,
              lockName,
              studentPersonId: values.student_person_id,
              studentProfileId: values.student_profile_id,
            },
          );
          throw createError;
        }

        this.logWarn(
          "[enrollments] Draft Enrollment duplicate constraint hit; reusing existing draft.",
          {
            code: createError?.code ?? DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE,
            enrollmentId: recoveredEnrollment.id ?? null,
            errno: createError?.errno ?? null,
            indexName: ACTIVE_DRAFT_UNIQUE_INDEX_NAME,
            lockName,
            studentPersonId: values.student_person_id,
            studentProfileId: values.student_profile_id,
          },
        );

        return {
          created: false,
          enrollment: recoveredEnrollment,
          reused: true,
        };
      }
    } catch (error) {
      operationError = error;
      throw error;
    } finally {
      if (lockAcquired) {
        try {
          const releaseResult = await this.releaseDraftEnrollmentLock(lockName);
          this.logInfo("[enrollments] Draft Enrollment idempotency lock released.", {
            lockName,
            released: releaseResult.released,
            releaseValue: releaseResult.releaseValue,
            studentPersonId: values.student_person_id,
            studentProfileId: values.student_profile_id,
          });
        } catch (releaseError) {
          this.logError("[enrollments] Draft Enrollment idempotency lock release failed.", {
            code: releaseError?.code ?? DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED_CODE,
            lockName,
            message:
              releaseError instanceof Error
                ? releaseError.message
                : String(releaseError ?? "Unknown error"),
            studentPersonId: values.student_person_id,
            studentProfileId: values.student_profile_id,
          });

          if (!operationError) {
            throw releaseError;
          }
        }
      }
    }
  }

  /**
   * Finds the latest persisted DRAFT Enrollment for a student/profile pair.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudent({ studentPersonId = null, studentProfileId = null } = {}) {
    const personId = nullableText(studentPersonId, 64);
    const profileId = nullableText(studentProfileId, 64);

    if (personId && profileId) {
      const rows = await this.query(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL, [
        EnrollmentStatus.DRAFT,
        personId,
        profileId,
      ]);

      return toEnrollmentDataFromRow(readFirstRow(rows));
    }

    if (personId) {
      return this.findDraftByStudentPersonId(personId);
    }

    if (profileId) {
      return this.findDraftByStudentProfileId(profileId);
    }

    return null;
  }

  /**
   * Finds the latest persisted DRAFT Enrollment by student Pessoa id.
   *
   * @param {string} studentPersonId
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudentPersonId(studentPersonId) {
    const personId = requiredText(studentPersonId, "studentPersonId", 64);
    const rows = await this.query(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL, [
      EnrollmentStatus.DRAFT,
      personId,
    ]);

    return toEnrollmentDataFromRow(readFirstRow(rows));
  }

  /**
   * Finds the latest persisted DRAFT Enrollment by student profile id.
   *
   * @param {string} studentProfileId
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudentProfileId(studentProfileId) {
    const profileId = requiredText(studentProfileId, "studentProfileId", 64);
    const rows = await this.query(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL, [
      EnrollmentStatus.DRAFT,
      profileId,
    ]);

    return toEnrollmentDataFromRow(readFirstRow(rows));
  }

  /**
   * Searches Aluno Pessoa/Profile scopes that can be used by administrative
   * Enrollment status queries. This stays read-only and does not touch legacy
   * j12_alunos tables.
   *
   * @param {Object} input
   * @param {string|null} [input.query]
   * @param {number|string|null} [input.limit]
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async searchStudentScopes({ query = null, limit = 10 } = {}) {
    const search = nullableText(query, 100);

    if (!search || search.length < 2) {
      return [];
    }

    const safeLimit = normalizeSearchLimit(limit);
    const likeTerm = `%${escapeLikeTerm(search)}%`;
    const documentDigits = search.replace(/\D/g, "");
    const documentTerm =
      documentDigits.length >= 2
        ? `%${escapeLikeTerm(documentDigits)}%`
        : "__J12_NO_DOCUMENT_MATCH__";
    // MySQL 8.4 can reject a LIMIT marker in this prepared statement. The value is
    // already clamped to an integer, so only that safe literal is embedded in SQL.
    const searchSql = withNormalizedLimit(SEARCH_ENROLLMENT_STUDENT_SCOPES_SQL, safeLimit);
    const rows = await this.query(searchSql, [
      EnrollmentStatus.DRAFT,
      EnrollmentStatus.ACTIVE,
      likeTerm,
      likeTerm,
      documentTerm,
      likeTerm,
      search,
      search,
    ]);
    const list = Array.isArray(rows?.[0]) ? rows[0] : Array.isArray(rows) ? rows : [];

    return list.map(toEnrollmentStudentScopeData);
  }

  /**
   * @param {string} lockName
   * @returns {Promise<void>}
   */
  async acquireDraftEnrollmentLock(lockName) {
    const rows = await this.query(GET_DRAFT_ENROLLMENT_LOCK_SQL, [
      lockName,
      this.lockTimeoutSeconds,
    ]);
    const row = readFirstRow(rows);
    const locked = Number(row?.locked);

    if (locked === 1) {
      return;
    }

    const errorCode =
      locked === 0 ? DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE : DRAFT_ENROLLMENT_LOCK_FAILED_CODE;
    const error = new Error(
      locked === 0
        ? "MySqlEnrollmentRepository timed out while acquiring draft enrollment idempotency lock."
        : "MySqlEnrollmentRepository could not acquire draft enrollment idempotency lock.",
    );

    error.code = errorCode;
    error.lockName = lockName;
    error.lockTimeoutSeconds = this.lockTimeoutSeconds;
    error.lockValue = Number.isFinite(locked) ? locked : null;

    this.logWarn("[enrollments] Draft Enrollment idempotency lock was not acquired.", {
      code: errorCode,
      lockName,
      lockTimeoutSeconds: this.lockTimeoutSeconds,
      lockValue: error.lockValue,
    });

    throw error;
  }

  /**
   * @param {string} lockName
   * @returns {Promise<{ released: boolean, releaseValue: number|null }>}
   */
  async releaseDraftEnrollmentLock(lockName) {
    const rows = await this.query(RELEASE_DRAFT_ENROLLMENT_LOCK_SQL, [lockName]);
    const row = readFirstRow(rows);
    const releaseValue = Number(row?.released);
    const normalizedReleaseValue = Number.isFinite(releaseValue) ? releaseValue : null;
    const released = normalizedReleaseValue === 1;

    if (!released) {
      this.logWarn(
        "[enrollments] Draft Enrollment idempotency lock release returned non-success.",
        {
          lockName,
          releaseValue: normalizedReleaseValue,
        },
      );
    }

    return {
      released,
      releaseValue: normalizedReleaseValue,
    };
  }

  /**
   * @param {string} message
   * @param {Record<string, unknown>} [context]
   * @returns {void}
   */
  logInfo(message, context = {}) {
    log(this, "info", message, context);
  }

  /**
   * @param {string} message
   * @param {Record<string, unknown>} [context]
   * @returns {void}
   */
  logWarn(message, context = {}) {
    log(this, "warn", message, context);
  }

  /**
   * @param {string} message
   * @param {Record<string, unknown>} [context]
   * @returns {void}
   */
  logError(message, context = {}) {
    log(this, "error", message, context);
  }
}

/**
 * @param {import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>|null|undefined} enrollment
 * @returns {Record<string, unknown>}
 */
function toEnrollmentData(enrollment) {
  if (!enrollment || typeof enrollment !== "object" || Array.isArray(enrollment)) {
    throw new TypeError("MySqlEnrollmentRepository.create requires an enrollment object.");
  }

  if (typeof enrollment.toJSON === "function") {
    return enrollment.toJSON();
  }

  return enrollment;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>|null}
 */
function toEnrollmentDataFromRow(row) {
  if (!row || typeof row !== "object") return null;

  return {
    confirmedAt: row.confirmed_at ?? null,
    confirmedBy: row.confirmed_by ?? null,
    createdAt: row.created_at ?? null,
    deletedAt: row.deleted_at ?? null,
    endDate: row.end_date ?? null,
    id: row.id ?? null,
    startDate: row.start_date ?? null,
    status: normalizeEnrollmentStatus(row.status) || nullableText(row.status, 32),
    studentPersonId: row.student_person_id ?? null,
    studentProfileId: row.student_profile_id ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * @param {Record<string, unknown>} enrollment
 * @returns {Record<string, unknown>}
 */
function toEnrollmentRowValues(enrollment = {}) {
  return {
    created_at: nullableText(enrollment.createdAt ?? enrollment.created_at, 32),
    deleted_at: nullableText(enrollment.deletedAt ?? enrollment.deleted_at, 32),
    end_date: nullableText(enrollment.endDate ?? enrollment.end_date, 10),
    id: requiredText(enrollment.id, "id", 64),
    start_date: requiredText(enrollment.startDate ?? enrollment.start_date, "startDate", 10),
    status: normalizeEnrollmentStatus(enrollment.status) || EnrollmentStatus.DRAFT,
    student_person_id: requiredText(
      enrollment.studentPersonId ?? enrollment.student_person_id,
      "studentPersonId",
      64,
    ),
    student_profile_id: requiredText(
      enrollment.studentProfileId ?? enrollment.student_profile_id,
      "studentProfileId",
      64,
    ),
    updated_at: nullableText(enrollment.updatedAt ?? enrollment.updated_at, 32),
  };
}

/**
 * @param {{ student_person_id: string, student_profile_id: string }} values
 * @returns {string}
 */
function buildDraftEnrollmentLockName(values) {
  const key = `${values.student_person_id}:${values.student_profile_id}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);

  return `enrollment:draft:${hash}`;
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
 * @returns {number}
 */
function normalizeLockTimeoutSeconds(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS;
  }

  return Math.trunc(parsed);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeSearchLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(Math.trunc(parsed), 25);
}

function withNormalizedLimit(sql, limit) {
  return sql.replace("LIMIT ?", `LIMIT ${limit}`);
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeLikeTerm(value) {
  return String(value ?? "").replace(/[\\%_]/g, "\\$&");
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toEnrollmentStudentScopeData(row = {}) {
  const hasDraftEnrollment = Number(row.has_draft_enrollment ?? 0) > 0;
  const hasActiveEnrollment = Number(row.has_active_enrollment ?? 0) > 0;
  let status = "NONE";

  if (hasDraftEnrollment && hasActiveEnrollment) {
    status = "CONFLICT";
  } else if (hasActiveEnrollment) {
    status = "ACTIVE";
  } else if (hasDraftEnrollment) {
    status = "DRAFT";
  }

  return {
    hasActiveEnrollment,
    hasDraftEnrollment,
    lastEnrollmentAt: row.last_enrollment_at ?? null,
    profileStatus: row.profile_status ?? null,
    status,
    studentCpf: row.student_cpf ?? null,
    studentEmail: row.student_email ?? null,
    studentName: row.student_name ?? null,
    studentPersonId: row.student_person_id ?? null,
    studentPhone: row.student_phone ?? null,
    studentProfileId: row.student_profile_id ?? null,
  };
}

/**
 * Only the active draft unique index is treated as expected concurrency.
 * Other duplicate-entry errors must keep surfacing as database errors.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isActiveDraftDuplicateEntryError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error;
  const duplicateCode = String(candidate.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(candidate.errno ?? candidate.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;

  if (!duplicateCode && !duplicateErrno) {
    return false;
  }

  const message = [candidate.message, candidate.sqlMessage, candidate.sql]
    .filter(Boolean)
    .join(" ");

  return message.includes(ACTIVE_DRAFT_UNIQUE_INDEX_NAME);
}

/**
 * @param {{ logger?: unknown }} owner
 * @param {"error"|"info"|"warn"} level
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 * @returns {void}
 */
function log(owner, level, message, context = {}) {
  const logger = owner?.logger;
  const writer = logger && typeof logger === "object" ? logger[level] : null;

  if (typeof writer !== "function") {
    return;
  }

  writer.call(logger, message, context);
}

/**
 * Loads the current mysql2 query wrapper lazily to avoid side effects when the
 * domain boundary is imported only for architecture discovery.
 *
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlEnrollmentRepository.create requires ${field}.`);
  }

  return normalized;
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

module.exports = {
  ACTIVE_DRAFT_UNIQUE_INDEX_NAME,
  DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS,
  DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE,
  DRAFT_ENROLLMENT_LOCK_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
  ENROLLMENTS_TABLE_NAME: TABLE_NAME,
  GET_DRAFT_ENROLLMENT_LOCK_SQL,
  INSERT_ENROLLMENT_SQL,
  MySqlEnrollmentRepository,
  RELEASE_DRAFT_ENROLLMENT_LOCK_SQL,
  SEARCH_ENROLLMENT_STUDENT_SCOPES_SQL,
  SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_ENROLLMENT_BY_ID_SQL,
  UPDATE_ENROLLMENT_STATUS_SQL,
  buildDraftEnrollmentLockName,
  escapeLikeTerm,
  isActiveDraftDuplicateEntryError,
  normalizeLockTimeoutSeconds,
  normalizeSearchLimit,
  readFirstRow,
  toEnrollmentStudentScopeData,
  toEnrollmentData,
  toEnrollmentDataFromRow,
  toEnrollmentRowValues,
};
