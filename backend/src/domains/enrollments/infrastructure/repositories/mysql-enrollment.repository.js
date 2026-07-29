const { createHash, randomUUID } = require("node:crypto");

const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");

const TABLE_NAME = "enrollments";
const ACTIVE_DRAFT_UNIQUE_INDEX_NAME = "ux_enrollments_active_draft_student_profile";
const ACTIVE_ENROLLMENT_UNIQUE_INDEX_NAME = "ux_enrollments_current_unit_student_profile";
const DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE = "DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT";
const ACTIVE_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE = "ACTIVE_ENROLLMENT_DUPLICATE_CONSTRAINT";
const ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE = "ENROLLMENT_DRAFT_OWNERSHIP_INVALID";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const ENROLLMENT_PROJECTION_SQL = `
    id,
    student_person_id,
    student_profile_id,
    CAST(unit_id AS CHAR) AS unit_id,
    responsible_person_id,
    responsible_profile_id,
    responsible_relationship_id,
    status,
    start_date,
    end_date,
    confirmed_at,
    confirmed_by,
    created_at,
    updated_at,
    deleted_at
`;

const INSERT_ENROLLMENT_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    student_person_id,
    student_profile_id,
    unit_id,
    responsible_person_id,
    responsible_profile_id,
    responsible_relationship_id,
    status,
    start_date,
    end_date,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?)
`;

const SELECT_ENROLLMENT_BY_ID_SQL = `
  SELECT
${ENROLLMENT_PROJECTION_SQL}
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL = `
  SELECT
${ENROLLMENT_PROJECTION_SQL}
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND unit_id = ?
    AND student_person_id = ?
    AND student_profile_id = ?
  ORDER BY confirmed_at DESC, updated_at DESC, created_at DESC, id DESC
  LIMIT 1
`;

const UPDATE_CANCEL_ACTIVE_ENROLLMENT_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status = ?
    AND deleted_at IS NULL
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
    AND unit_id = ?
    AND status = ?
    AND deleted_at IS NULL
  LIMIT 1
`;

const SELECT_VALID_DRAFT_OWNERSHIP_SQL = `
  SELECT
    CAST(unit_scope.id AS CHAR) AS unit_id,
    responsible_person.id AS responsible_person_id,
    responsible_profile.id AS responsible_profile_id,
    responsible_relationship.id AS responsible_relationship_id,
    student_person.id AS student_person_id,
    student_profile.id AS student_profile_id
  FROM j12_unidades unit_scope
  INNER JOIN people responsible_person
    ON responsible_person.id = ?
   AND responsible_person.ativo = 1
  INNER JOIN person_profiles responsible_profile
    ON responsible_profile.id = ?
   AND responsible_profile.person_id = responsible_person.id
   AND LOWER(responsible_profile.profile_type) = 'responsavel'
   AND LOWER(responsible_profile.status) IN ('active', 'ativo')
  INNER JOIN people student_person
    ON student_person.id = ?
   AND student_person.ativo = 1
  INNER JOIN person_profiles student_profile
    ON student_profile.id = ?
   AND student_profile.person_id = student_person.id
   AND LOWER(student_profile.profile_type) = 'aluno'
   AND LOWER(student_profile.status) IN ('active', 'ativo')
  INNER JOIN person_relationships responsible_relationship
    ON responsible_relationship.id = ?
   AND responsible_relationship.person_id = responsible_person.id
   AND responsible_relationship.related_person_id = student_person.id
   AND LOWER(responsible_relationship.status) = 'active'
  WHERE unit_scope.id = ?
  LIMIT 1
  LOCK IN SHARE MODE
`;

const SELECT_DRAFT_OPENING_OWNERSHIP_SQL = `
  SELECT
    CAST(unit_scope.id AS CHAR) AS unit_id,
    responsible_person.id AS responsible_person_id,
    responsible_profile.id AS responsible_profile_id,
    responsible_relationship.id AS responsible_relationship_id,
    student_person.id AS student_person_id,
    student_profile.id AS student_profile_id
  FROM j12_unidades unit_scope
  INNER JOIN people responsible_person
    ON responsible_person.id = ?
   AND responsible_person.ativo = 1
  INNER JOIN person_profiles responsible_profile
    ON responsible_profile.person_id = responsible_person.id
   AND LOWER(responsible_profile.profile_type) = 'responsavel'
   AND LOWER(responsible_profile.status) IN ('active', 'ativo')
  INNER JOIN people student_person
    ON student_person.id = ?
   AND student_person.ativo = 1
  INNER JOIN person_profiles student_profile
    ON student_profile.person_id = student_person.id
   AND LOWER(student_profile.profile_type) = 'aluno'
   AND LOWER(student_profile.status) IN ('active', 'ativo')
  INNER JOIN person_relationships responsible_relationship
    ON responsible_relationship.person_id = responsible_person.id
   AND responsible_relationship.related_person_id = student_person.id
   AND LOWER(responsible_relationship.status) = 'active'
  WHERE unit_scope.id = ?
  ORDER BY responsible_profile.id, student_profile.id, responsible_relationship.id
  LIMIT 2
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL = `
  SELECT
${ENROLLMENT_PROJECTION_SQL}
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND unit_id = ?
    AND student_person_id = ?
    AND student_profile_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL = `
  SELECT
${ENROLLMENT_PROJECTION_SQL}
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND unit_id = ?
    AND student_person_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL = `
  SELECT
${ENROLLMENT_PROJECTION_SQL}
  FROM ${TABLE_NAME}
  WHERE status = ?
    AND deleted_at IS NULL
    AND unit_id = ?
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
   AND enrollment.unit_id = ?
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
const DRAFT_ENROLLMENT_CONNECTION_RELEASE_FAILED_CODE =
  "DRAFT_ENROLLMENT_CONNECTION_RELEASE_FAILED";
const GET_DRAFT_ENROLLMENT_LOCK_SQL = "SELECT GET_LOCK(?, ?) AS locked";
const RELEASE_DRAFT_ENROLLMENT_LOCK_SQL = "SELECT RELEASE_LOCK(?) AS released";
const START_TRANSACTION_SQL = "START TRANSACTION";
const COMMIT_TRANSACTION_SQL = "COMMIT";
const ROLLBACK_TRANSACTION_SQL = "ROLLBACK";

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
   * @param {() => Promise<{ execute: Function, release: Function }>} [options.connectionProvider]
   */
  constructor({
    connectionProvider = null,
    logger = console,
    lockTimeoutSeconds = DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS,
    queryRunner = null,
  } = {}) {
    this.logger = logger;
    this.lockTimeoutSeconds = normalizeLockTimeoutSeconds(lockTimeoutSeconds);
    this.query = queryRunner || getDefaultQueryRunner();
    this.connectionProvider = connectionProvider || getDefaultConnectionProvider();
  }

  /**
   * Creates an Enrollment row.
   *
   * @param {import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>} enrollment
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async create(enrollment, queryRunner = this.query, { ownershipValidated = false } = {}) {
    const input = toEnrollmentData(enrollment);
    const id = nullableText(input.id, 64) || randomUUID();
    const values = toEnrollmentRowValues({ ...input, id });

    if (
      !ownershipValidated &&
      [EnrollmentStatus.DRAFT, EnrollmentStatus.ACTIVE].includes(values.status)
    ) {
      await this.validateDraftOwnership(values, queryRunner);
    }

    await queryRunner(INSERT_ENROLLMENT_SQL, [
      values.id,
      values.student_person_id,
      values.student_profile_id,
      values.unit_id,
      values.responsible_person_id,
      values.responsible_profile_id,
      values.responsible_relationship_id,
      values.status,
      values.start_date,
      values.end_date,
      values.created_at,
      values.updated_at,
      values.deleted_at,
    ]);

    const rows = await queryRunner(SELECT_ENROLLMENT_BY_ID_SQL, [id]);
    const row = readFirstRow(rows) || values;

    return toEnrollmentDataFromRow(row);
  }

  /**
   * Finds an Enrollment by aggregate id.
   *
   * @param {string} id
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findById(id, queryRunner = this.query) {
    const enrollmentId = requiredText(id, "id", 64);
    const rows = await queryRunner(SELECT_ENROLLMENT_BY_ID_SQL, [enrollmentId]);

    return toEnrollmentDataFromRow(readFirstRow(rows));
  }

  /**
   * Finds the latest persisted ACTIVE Enrollment for a student/profile pair.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.unitId]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findActiveByStudent({
    studentPersonId = null,
    studentProfileId = null,
    unitId = null,
  } = {}) {
    const personId = nullableText(studentPersonId, 64);
    const profileId = nullableText(studentProfileId, 64);
    const canonicalUnitId = nullableCanonicalUnitId(unitId);

    if (!personId || !profileId || !canonicalUnitId) {
      return null;
    }

    const rows = await this.query(SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL, [
      EnrollmentStatus.ACTIVE,
      canonicalUnitId,
      personId,
      profileId,
    ]);

    return toEnrollmentDataFromRowForUnit(readFirstRow(rows), canonicalUnitId);
  }

  /**
   * Conditionally cancels an ACTIVE Enrollment without touching class links or integrations.
   *
   * @param {{ enrollmentId?: string|null, expectedStatus?: string|null, status?: string|null }} input
   * @returns {Promise<{ changed: boolean }>}
   */
  async cancelActiveEnrollment(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const expectedStatus = normalizeEnrollmentStatus(input.expectedStatus);
    const nextStatus = normalizeEnrollmentStatus(input.status);

    if (expectedStatus !== EnrollmentStatus.ACTIVE || nextStatus !== EnrollmentStatus.CANCELLED) {
      throw new TypeError(
        "MySqlEnrollmentRepository.cancelActiveEnrollment requires ACTIVE -> CANCELLED statuses.",
      );
    }

    const result = await this.query(UPDATE_CANCEL_ACTIVE_ENROLLMENT_SQL, [
      EnrollmentStatus.CANCELLED,
      enrollmentId,
      EnrollmentStatus.ACTIVE,
    ]);

    return {
      changed: readAffectedRows(result) > 0,
    };
  }
  /**
   * Updates Enrollment status and confirmation audit fields when activating.
   *
   * @param {string} id
   * @param {string} status
   * @param {{ confirmedAt?: string|null, confirmedBy?: string|null }} [options]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async updateStatus(
    id,
    status,
    { confirmedAt = null, confirmedBy = null, expectedStatus = null, unitId = null } = {},
  ) {
    const enrollmentId = requiredText(id, "id", 64);
    const normalizedStatus = normalizeEnrollmentStatus(status);

    if (!normalizedStatus) {
      throw new TypeError("MySqlEnrollmentRepository.updateStatus requires a valid status.");
    }

    const canonicalUnitId = requiredCanonicalUnitId(unitId);
    const normalizedExpectedStatus = normalizeEnrollmentStatus(expectedStatus);
    if (!normalizedExpectedStatus) {
      throw new TypeError("MySqlEnrollmentRepository.updateStatus requires expectedStatus.");
    }

    let transitionChanged = false;
    try {
      const updateResult = await this.query(UPDATE_ENROLLMENT_STATUS_SQL, [
        normalizedStatus,
        normalizedStatus,
        EnrollmentStatus.ACTIVE,
        nullableText(confirmedAt, 32),
        normalizedStatus,
        EnrollmentStatus.ACTIVE,
        nullableText(confirmedBy, 191),
        enrollmentId,
        canonicalUnitId,
        normalizedExpectedStatus,
      ]);
      transitionChanged = readAffectedRows(updateResult) > 0;
    } catch (error) {
      if (!isActiveEnrollmentDuplicateEntryError(error)) throw error;
      const conflict = new Error(
        "Active Enrollment uniqueness constraint rejected the transition.",
      );
      conflict.code = ACTIVE_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE;
      conflict.cause = error;
      throw conflict;
    }

    const enrollment = await this.findById(enrollmentId);
    return enrollment?.unitId === canonicalUnitId ? { ...enrollment, transitionChanged } : null;
  }

  /**
   * Validates the complete modern Enrollment ownership against canonical
   * People/Profile/relationship/unit rows. No legacy table is used as fallback.
   */
  async validateDraftOwnership(enrollment, queryRunner = this.query) {
    const input = toEnrollmentData(enrollment);
    const values = toEnrollmentRowValues({ ...input, id: input.id || "ownership-validation" });
    const rows = await queryRunner(SELECT_VALID_DRAFT_OWNERSHIP_SQL, [
      values.responsible_person_id,
      values.responsible_profile_id,
      values.student_person_id,
      values.student_profile_id,
      values.responsible_relationship_id,
      values.unit_id,
    ]);
    const row = readFirstRow(rows);
    if (
      !row ||
      String(row.unit_id ?? "") !== values.unit_id ||
      row.responsible_person_id !== values.responsible_person_id ||
      row.responsible_profile_id !== values.responsible_profile_id ||
      row.responsible_relationship_id !== values.responsible_relationship_id ||
      row.student_person_id !== values.student_person_id ||
      row.student_profile_id !== values.student_profile_id
    ) {
      const error = new Error(
        "Enrollment DRAFT ownership does not match canonical active records.",
      );
      error.code = ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE;
      throw error;
    }
  }

  /**
   * Resolves the active canonical profiles and responsible relationship needed
   * to open a DRAFT for the actor unit.
   *
   * @param {import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>} enrollment
   * @returns {Promise<Record<string, unknown>>}
   */
  async resolveDraftOpeningOwnership(enrollment = {}) {
    const input = enrollment;
    const responsiblePersonId = requiredText(input.responsiblePersonId, "responsiblePersonId", 64);
    const studentPersonId = requiredText(input.studentPersonId, "studentPersonId", 64);
    const unitId = requiredCanonicalUnitId(input.unitId);
    const rows = await this.query(SELECT_DRAFT_OPENING_OWNERSHIP_SQL, [
      responsiblePersonId,
      studentPersonId,
      unitId,
    ]);

    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (
      !row ||
      row.responsible_person_id !== responsiblePersonId ||
      row.student_person_id !== studentPersonId ||
      String(row.unit_id) !== unitId
    ) {
      const error = new Error("Enrollment DRAFT ownership is invalid or ambiguous.");
      error.code = ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE;
      throw error;
    }

    return Object.freeze({
      responsiblePersonId: row.responsible_person_id,
      responsibleProfileId: row.responsible_profile_id,
      responsibleRelationshipId: row.responsible_relationship_id,
      studentPersonId: row.student_person_id,
      studentProfileId: row.student_profile_id,
      unitId: String(row.unit_id),
    });
  }

  /**
   * Creates a DRAFT Enrollment only when one does not already exist for the
   * same student, profile and canonical unit. The existing named lock and
   * physical constraints preserve idempotency under concurrency.
   */
  async createDraftIfNotExists(enrollment) {
    const input = toEnrollmentData(enrollment);
    const id = nullableText(input.id, 64) || randomUUID();
    const values = toEnrollmentRowValues({ ...input, id, status: EnrollmentStatus.DRAFT });
    const lockName = buildDraftEnrollmentLockName(values);
    let connection = null;
    let dedicatedQuery = null;
    let lockAcquired = false;
    let operationError = null;
    let cleanupError = null;
    let transactionStarted = false;
    let transactionCompleted = false;

    try {
      connection = await this.getDedicatedConnection();
      dedicatedQuery = createConnectionQueryRunner(connection);
      await this.acquireDraftEnrollmentLock(lockName, dedicatedQuery);
      lockAcquired = true;
      this.logInfo("[enrollments] Draft Enrollment idempotency lock acquired.", {
        lockName,
        studentPersonId: values.student_person_id,
        studentProfileId: values.student_profile_id,
      });
      await dedicatedQuery(START_TRANSACTION_SQL);
      transactionStarted = true;
      await this.validateDraftOwnership(values, dedicatedQuery);

      const existingEnrollment = await this.findDraftByStudent(
        {
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
          unitId: values.unit_id,
        },
        dedicatedQuery,
      );

      if (existingEnrollment) {
        assertSameDraftOwnership(values, existingEnrollment);
        this.logInfo("[enrollments] Reusing existing draft Enrollment inside idempotency lock.", {
          enrollmentId: existingEnrollment.id ?? null,
          lockName,
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
        });

        await dedicatedQuery(COMMIT_TRANSACTION_SQL);
        transactionCompleted = true;
        return {
          created: false,
          enrollment: existingEnrollment,
          reused: true,
        };
      }

      try {
        const createdEnrollment = await this.create(
          {
            ...input,
            id,
            status: EnrollmentStatus.DRAFT,
          },
          dedicatedQuery,
          { ownershipValidated: true },
        );
        this.logInfo("[enrollments] Created new draft Enrollment inside idempotency lock.", {
          enrollmentId: createdEnrollment?.id ?? null,
          lockName,
          studentPersonId: values.student_person_id,
          studentProfileId: values.student_profile_id,
        });

        await dedicatedQuery(COMMIT_TRANSACTION_SQL);
        transactionCompleted = true;
        return {
          created: true,
          enrollment: createdEnrollment,
          reused: false,
        };
      } catch (createError) {
        if (!isActiveDraftDuplicateEntryError(createError)) {
          throw createError;
        }

        const recoveredEnrollment = await this.findDraftByStudent(
          {
            studentPersonId: values.student_person_id,
            studentProfileId: values.student_profile_id,
            unitId: values.unit_id,
          },
          dedicatedQuery,
        );

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
        assertSameDraftOwnership(values, recoveredEnrollment);

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

        await dedicatedQuery(COMMIT_TRANSACTION_SQL);
        transactionCompleted = true;
        return {
          created: false,
          enrollment: recoveredEnrollment,
          reused: true,
        };
      }
    } catch (error) {
      operationError = error;
      if (transactionStarted && !transactionCompleted && dedicatedQuery) {
        try {
          await dedicatedQuery(ROLLBACK_TRANSACTION_SQL);
          transactionCompleted = true;
        } catch (rollbackError) {
          this.logError("[enrollments] Draft Enrollment transaction rollback failed.", {
            code: rollbackError?.code ?? null,
            lockName,
          });
          error.rollbackError = rollbackError;
        }
      }
      throw error;
    } finally {
      if (lockAcquired) {
        try {
          const releaseResult = await this.releaseDraftEnrollmentLock(lockName, dedicatedQuery);
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

          cleanupError = releaseError;
        }
      }
      if (connection) {
        try {
          await connection.release();
        } catch (releaseError) {
          this.logError("[enrollments] Dedicated draft connection release failed.", {
            code: DRAFT_ENROLLMENT_CONNECTION_RELEASE_FAILED_CODE,
            lockName,
          });
          if (!cleanupError) {
            const normalizedError =
              releaseError instanceof Error
                ? releaseError
                : new Error("Dedicated draft connection release failed.");
            normalizedError.code ||= DRAFT_ENROLLMENT_CONNECTION_RELEASE_FAILED_CODE;
            cleanupError = normalizedError;
          }
        }
      }
      if (!operationError && cleanupError) throw cleanupError;
    }
  }

  /**
   * Finds the latest persisted DRAFT Enrollment for a student/profile pair.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.unitId]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudent(
    { studentPersonId = null, studentProfileId = null, unitId = null } = {},
    queryRunner = this.query,
  ) {
    const personId = nullableText(studentPersonId, 64);
    const profileId = nullableText(studentProfileId, 64);
    const canonicalUnitId = nullableCanonicalUnitId(unitId);

    if (!canonicalUnitId) {
      return null;
    }

    if (personId && profileId) {
      const rows = await queryRunner(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL, [
        EnrollmentStatus.DRAFT,
        canonicalUnitId,
        personId,
        profileId,
      ]);

      return toEnrollmentDataFromRowForUnit(readFirstRow(rows), canonicalUnitId);
    }

    if (personId) {
      return this.findDraftByStudentPersonId(personId, canonicalUnitId, queryRunner);
    }

    if (profileId) {
      return this.findDraftByStudentProfileId(profileId, canonicalUnitId, queryRunner);
    }

    return null;
  }

  /**
   * Finds the latest persisted DRAFT Enrollment by student Pessoa id.
   *
   * @param {string} studentPersonId
   * @param {string} unitId
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudentPersonId(studentPersonId, unitId, queryRunner = this.query) {
    const personId = requiredText(studentPersonId, "studentPersonId", 64);
    const canonicalUnitId = nullableCanonicalUnitId(unitId);

    if (!canonicalUnitId) {
      return null;
    }

    const rows = await queryRunner(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL, [
      EnrollmentStatus.DRAFT,
      canonicalUnitId,
      personId,
    ]);

    return toEnrollmentDataFromRowForUnit(readFirstRow(rows), canonicalUnitId);
  }

  /**
   * Finds the latest persisted DRAFT Enrollment by student profile id.
   *
   * @param {string} studentProfileId
   * @param {string} unitId
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findDraftByStudentProfileId(studentProfileId, unitId, queryRunner = this.query) {
    const profileId = requiredText(studentProfileId, "studentProfileId", 64);
    const canonicalUnitId = nullableCanonicalUnitId(unitId);

    if (!canonicalUnitId) {
      return null;
    }

    const rows = await queryRunner(SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL, [
      EnrollmentStatus.DRAFT,
      canonicalUnitId,
      profileId,
    ]);

    return toEnrollmentDataFromRowForUnit(readFirstRow(rows), canonicalUnitId);
  }

  /**
   * Searches Aluno Pessoa/Profile scopes that can be used by administrative
   * Enrollment status queries. This stays read-only and does not touch legacy
   * j12_alunos tables.
   *
   * @param {Object} input
   * @param {string|null} [input.query]
   * @param {number|string|null} [input.limit]
   * @param {string|null} [input.unitId]
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async searchStudentScopes({ query = null, limit = 10, unitId = null } = {}) {
    const search = nullableText(query, 100);
    const canonicalUnitId = nullableCanonicalUnitId(unitId);

    if (!search || search.length < 2) {
      return [];
    }
    if (!canonicalUnitId) {
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
      canonicalUnitId,
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
  async acquireDraftEnrollmentLock(lockName, queryRunner = this.query) {
    const rows = await queryRunner(GET_DRAFT_ENROLLMENT_LOCK_SQL, [
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
  async releaseDraftEnrollmentLock(lockName, queryRunner = this.query) {
    const rows = await queryRunner(RELEASE_DRAFT_ENROLLMENT_LOCK_SQL, [lockName]);
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
      const error = new Error(
        "MySqlEnrollmentRepository could not release draft enrollment idempotency lock.",
      );
      error.code = DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED_CODE;
      error.lockName = lockName;
      error.releaseValue = normalizedReleaseValue;
      throw error;
    }

    return {
      released,
      releaseValue: normalizedReleaseValue,
    };
  }

  async getDedicatedConnection() {
    if (typeof this.connectionProvider !== "function") {
      throw new TypeError("MySqlEnrollmentRepository requires a connectionProvider function.");
    }
    const connection = await this.connectionProvider();
    if (
      !connection ||
      typeof connection.execute !== "function" ||
      typeof connection.release !== "function"
    ) {
      throw new TypeError("MySqlEnrollmentRepository requires a dedicated MySQL connection.");
    }
    return connection;
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
    responsiblePersonId: row.responsible_person_id ?? null,
    responsibleProfileId: row.responsible_profile_id ?? null,
    responsibleRelationshipId: row.responsible_relationship_id ?? null,
    startDate: row.start_date ?? null,
    status: normalizeEnrollmentStatus(row.status) || nullableText(row.status, 32),
    studentPersonId: row.student_person_id ?? null,
    studentProfileId: row.student_profile_id ?? null,
    unitId: row.unit_id == null ? null : String(row.unit_id),
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Fails closed if a query adapter returns a legacy or cross-unit row despite
 * the canonical unit predicate.
 *
 * @param {Record<string, unknown>|null} row
 * @param {string} unitId
 * @returns {Record<string, unknown>|null}
 */
function toEnrollmentDataFromRowForUnit(row, unitId) {
  const enrollment = toEnrollmentDataFromRow(row);

  if (!enrollment || enrollment.unitId !== unitId) {
    return null;
  }

  return enrollment;
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
    unit_id: requiredCanonicalUnitId(enrollment.unitId ?? enrollment.unit_id),
    responsible_person_id: requiredText(
      enrollment.responsiblePersonId ?? enrollment.responsible_person_id,
      "responsiblePersonId",
      64,
    ),
    responsible_profile_id: requiredText(
      enrollment.responsibleProfileId ?? enrollment.responsible_profile_id,
      "responsibleProfileId",
      64,
    ),
    responsible_relationship_id: requiredText(
      enrollment.responsibleRelationshipId ?? enrollment.responsible_relationship_id,
      "responsibleRelationshipId",
      64,
    ),
    updated_at: nullableText(enrollment.updatedAt ?? enrollment.updated_at, 32),
  };
}

/**
 * @param {{ student_person_id: string, student_profile_id: string, unit_id: string }} values
 * @returns {string}
 */
function buildDraftEnrollmentLockName(values) {
  const unitId = requiredCanonicalUnitId(values.unit_id);
  const key = `${unitId}:${values.student_person_id}:${values.student_profile_id}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);

  return `enrollment:draft:${hash}`;
}

/**
 * Reads affectedRows from both mysql2 execute results and project query wrappers.
 *
 * Supported shapes:
 * - ResultSetHeader
 * - [ResultSetHeader, fields]
 *
 * @param {unknown} result
 * @returns {number}
 */
function readAffectedRows(result) {
  if (Array.isArray(result)) {
    const header = result.find(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        Object.prototype.hasOwnProperty.call(item, "affectedRows"),
    );

    return normalizeAffectedRows(header?.affectedRows);
  }

  if (result && typeof result === "object") {
    return normalizeAffectedRows(result.affectedRows);
  }

  return 0;
}

/**
 * Normalizes MySQL affectedRows without accepting invalid values.
 *
 * @param {unknown} value
 * @returns {number}
 */
function normalizeAffectedRows(value) {
  const normalized = Number(value);

  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
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

function assertSameDraftOwnership(requested, existing) {
  const pairs = [
    ["student_person_id", "studentPersonId"],
    ["student_profile_id", "studentProfileId"],
    ["responsible_person_id", "responsiblePersonId"],
    ["responsible_profile_id", "responsibleProfileId"],
    ["responsible_relationship_id", "responsibleRelationshipId"],
  ];
  const mismatches = pairs
    .filter(
      ([rowField, dataField]) => requested[rowField] !== nullableText(existing[dataField], 64),
    )
    .map(([, dataField]) => dataField);
  if (requested.unit_id !== nullableCanonicalUnitId(existing.unitId)) mismatches.push("unitId");
  if (mismatches.length === 0) return;

  const error = new Error("Existing DRAFT ownership conflicts with the requested Enrollment.");
  error.code = DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE;
  error.mismatches = mismatches;
  throw error;
}

function isActiveEnrollmentDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;
  if (!duplicateCode && !duplicateErrno) return false;
  return [error.message, error.sqlMessage, error.sql]
    .filter(Boolean)
    .join(" ")
    .includes(ACTIVE_ENROLLMENT_UNIQUE_INDEX_NAME);
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

function getDefaultConnectionProvider() {
  return () => require("../../../../config/db.js").pool.getConnection();
}

function createConnectionQueryRunner(connection) {
  if (!connection || typeof connection.execute !== "function") {
    throw new TypeError("Dedicated query runner requires connection.execute.");
  }
  return async (sql, params = []) => {
    const [rows] = await connection.execute(sql, params);
    return rows;
  };
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

/**
 * Preserves canonical BIGINT identity as a decimal string.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableCanonicalUnitId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/u.test(value)) {
    return null;
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requiredCanonicalUnitId(value) {
  const unitId = nullableCanonicalUnitId(value);

  if (!unitId) {
    throw new TypeError("MySqlEnrollmentRepository.create requires unitId.");
  }

  return unitId;
}

module.exports = {
  ACTIVE_DRAFT_UNIQUE_INDEX_NAME,
  ACTIVE_ENROLLMENT_UNIQUE_INDEX_NAME,
  ACTIVE_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE,
  DEFAULT_DRAFT_ENROLLMENT_LOCK_TIMEOUT_SECONDS,
  DRAFT_ENROLLMENT_DUPLICATE_CONSTRAINT_CODE,
  DRAFT_ENROLLMENT_CONNECTION_RELEASE_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
  ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE,
  ENROLLMENT_PROJECTION_SQL,
  ENROLLMENTS_TABLE_NAME: TABLE_NAME,
  GET_DRAFT_ENROLLMENT_LOCK_SQL,
  INSERT_ENROLLMENT_SQL,
  SELECT_VALID_DRAFT_OWNERSHIP_SQL,
  SELECT_DRAFT_OPENING_OWNERSHIP_SQL,
  MySqlEnrollmentRepository,
  RELEASE_DRAFT_ENROLLMENT_LOCK_SQL,
  SEARCH_ENROLLMENT_STUDENT_SCOPES_SQL,
  SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_ENROLLMENT_BY_ID_SQL,
  UPDATE_ENROLLMENT_STATUS_SQL,
  START_TRANSACTION_SQL,
  COMMIT_TRANSACTION_SQL,
  ROLLBACK_TRANSACTION_SQL,
  buildDraftEnrollmentLockName,
  assertSameDraftOwnership,
  createConnectionQueryRunner,
  escapeLikeTerm,
  isActiveDraftDuplicateEntryError,
  isActiveEnrollmentDuplicateEntryError,
  normalizeLockTimeoutSeconds,
  normalizeSearchLimit,
  readAffectedRows,
  readFirstRow,
  toEnrollmentStudentScopeData,
  toEnrollmentData,
  toEnrollmentDataFromRow,
  toEnrollmentDataFromRowForUnit,
  toEnrollmentRowValues,
};
