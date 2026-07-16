const RESOLVE_ENROLLMENT_LEGACY_STUDENT_IDENTITY_SQL = `
  SELECT
    enrollment_record.id AS enrollment_id,
    person.id AS person_id,
    profile.id AS profile_id,
    legacy_student.id AS legacy_student_id
  FROM (
    SELECT ? AS enrollment_id, ? AS person_id, ? AS profile_id, ? AS legacy_student_id
  ) requested
  LEFT JOIN enrollments enrollment_record
    ON enrollment_record.id = requested.enrollment_id
    AND enrollment_record.student_person_id = requested.person_id
    AND enrollment_record.student_profile_id = requested.profile_id
    AND enrollment_record.deleted_at IS NULL
  LEFT JOIN people person
    ON person.id = enrollment_record.student_person_id
  LEFT JOIN person_profiles profile
    ON profile.id = enrollment_record.student_profile_id
    AND profile.person_id = person.id
    AND LOWER(profile.profile_type) = 'aluno'
  LEFT JOIN j12_alunos legacy_student
    ON CAST(legacy_student.id AS CHAR) = CAST(requested.legacy_student_id AS CHAR)
`;

/**
 * Read-only adapter for the explicit Enrollment -> legacy student identity.
 * It never searches by name, CPF, e-mail or another mutable attribute.
 */
class MySqlEnrollmentLegacyStudentIdentityRepository {
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  async resolveEnrollmentLegacyStudentIdentity(input = {}) {
    const rows = await this.query(RESOLVE_ENROLLMENT_LEGACY_STUDENT_IDENTITY_SQL, [
      input.enrollmentId,
      input.personId,
      input.profileId,
      input.legacyStudentId,
    ]);
    const list = Array.isArray(rows?.[0]) ? rows[0] : Array.isArray(rows) ? rows : [];

    return list.map((row) => ({
      enrollmentId: row.enrollment_id ?? null,
      legacyStudentId: row.legacy_student_id ?? null,
      personId: row.person_id ?? null,
      profileId: row.profile_id ?? null,
    }));
  }
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  MySqlEnrollmentLegacyStudentIdentityRepository,
  RESOLVE_ENROLLMENT_LEGACY_STUDENT_IDENTITY_SQL,
};
