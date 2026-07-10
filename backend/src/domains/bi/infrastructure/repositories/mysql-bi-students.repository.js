const { BiReadRepositoryContract } = require("../../application/index.js");
const { EnrollmentStatus } = require("../../../enrollments/domain/enums/enrollment-status.enum.js");

const UNIT_SCOPE_SQL = `(? IS NULL OR EXISTS (
  SELECT 1 FROM enrollment_class_links unit_link
  INNER JOIN j12_turmas unit_class ON unit_class.id = unit_link.class_id
  WHERE unit_link.enrollment_id = e.id AND unit_link.status = 'ACTIVE'
    AND CAST(unit_class.unidade_id AS CHAR) = ?
))`;

const STUDENT_KPIS_SQL = `
  SELECT
    COUNT(DISTINCT CASE WHEN e.status = ? THEN e.student_person_id END) active_students,
    COUNT(DISTINCT CASE WHEN e.status = ? THEN e.id END) active_enrollments,
    COUNT(DISTINCT CASE WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?,INTERVAL 1 DAY)
      AND NOT EXISTS (SELECT 1 FROM enrollments earlier WHERE earlier.student_person_id=e.student_person_id AND earlier.deleted_at IS NULL AND earlier.confirmed_at IS NOT NULL AND earlier.confirmed_at < e.confirmed_at)
      THEN e.student_person_id END) new_students,
    COUNT(DISTINCT CASE WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?,INTERVAL 1 DAY) THEN e.id END) new_enrollments,
    COUNT(DISTINCT CASE WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?,INTERVAL 1 DAY)
      AND NOT EXISTS (SELECT 1 FROM enrollments earlier WHERE earlier.student_person_id=e.student_person_id AND earlier.deleted_at IS NULL AND earlier.confirmed_at IS NOT NULL AND earlier.confirmed_at < e.confirmed_at)
      THEN e.student_person_id END) previous_new_students,
    COUNT(DISTINCT CASE WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?,INTERVAL 1 DAY) THEN e.id END) previous_new_enrollments
  FROM enrollments e
  INNER JOIN person_profiles profile ON profile.id=e.student_profile_id AND profile.person_id=e.student_person_id AND profile.profile_type='aluno'
  WHERE e.deleted_at IS NULL AND ${UNIT_SCOPE_SQL}
`;

const STUDENT_EVOLUTION_SQL = `
  SELECT DATE_FORMAT(e.confirmed_at,'%Y-%m') period,
    COUNT(DISTINCT e.id) new_enrollments,
    COUNT(DISTINCT CASE WHEN NOT EXISTS (
      SELECT 1 FROM enrollments earlier
      WHERE earlier.student_person_id=e.student_person_id AND earlier.deleted_at IS NULL
        AND earlier.confirmed_at IS NOT NULL AND earlier.confirmed_at < e.confirmed_at
    ) THEN e.student_person_id END) new_students
  FROM enrollments e
  INNER JOIN person_profiles profile ON profile.id=e.student_profile_id AND profile.person_id=e.student_person_id AND profile.profile_type='aluno'
  WHERE e.deleted_at IS NULL AND e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?,INTERVAL 1 DAY)
    AND ${UNIT_SCOPE_SQL}
  GROUP BY period ORDER BY period
`;

const STUDENT_DISTRIBUTIONS_SQL = `
  WITH age_reference AS (SELECT CAST(? AS DATE) reference_date)
  SELECT 'modality' dimension,COALESCE(NULLIF(class.modalidade,''),'nao_informado') dimension_key,COUNT(DISTINCT e.student_person_id) value
  FROM enrollments e INNER JOIN person_profiles profile ON profile.id=e.student_profile_id AND profile.person_id=e.student_person_id AND profile.profile_type=?
  INNER JOIN enrollment_class_links link ON link.enrollment_id=e.id AND link.status=?
  INNER JOIN j12_turmas class ON class.id=link.class_id
  WHERE e.deleted_at IS NULL AND e.status=? AND ${UNIT_SCOPE_SQL} GROUP BY class.modalidade
  UNION ALL
  SELECT 'unit',COALESCE(NULLIF(class.unidade,''),'nao_informado'),COUNT(DISTINCT e.student_person_id)
  FROM enrollments e INNER JOIN person_profiles profile ON profile.id=e.student_profile_id AND profile.person_id=e.student_person_id AND profile.profile_type=?
  INNER JOIN enrollment_class_links link ON link.enrollment_id=e.id AND link.status=?
  INNER JOIN j12_turmas class ON class.id=link.class_id
  WHERE e.deleted_at IS NULL AND e.status=? AND ${UNIT_SCOPE_SQL} GROUP BY class.unidade
  UNION ALL
  SELECT 'age',CASE
    WHEN person.data_nascimento IS NULL THEN 'nao_informado'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) NOT BETWEEN 0 AND 120 THEN 'nao_informado'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 6 THEN '0-5'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 12 THEN '6-11'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 18 THEN '12-17'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 30 THEN '18-29'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 45 THEN '30-44'
    WHEN TIMESTAMPDIFF(YEAR,person.data_nascimento,age_reference.reference_date) < 60 THEN '45-59'
    ELSE '60+'
  END,COUNT(DISTINCT e.student_person_id)
  FROM enrollments e INNER JOIN person_profiles profile ON profile.id=e.student_profile_id AND profile.person_id=e.student_person_id AND profile.profile_type=?
  INNER JOIN people person ON person.id=e.student_person_id
  CROSS JOIN age_reference
  WHERE e.deleted_at IS NULL AND e.status=? AND ${UNIT_SCOPE_SQL}
  GROUP BY dimension_key ORDER BY dimension,dimension_key
`;

class MySqlBiStudentsRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getStudentAnalytics({ current, previous }) {
    const [kpiResult, evolutionResult, distributionResult] = await Promise.all([
      this.query(STUDENT_KPIS_SQL, kpiParams(current, previous)),
      this.query(STUDENT_EVOLUTION_SQL, evolutionParams(current)),
      this.query(STUDENT_DISTRIBUTIONS_SQL, distributionParams(current)),
    ]);
    const kpis = readRows(kpiResult)[0] || {};
    const distributions = readRows(distributionResult);
    return {
      ageGroups: dimension(distributions, "age"),
      current: {
        activeEnrollments: numeric(kpis.active_enrollments),
        activeStudents: numeric(kpis.active_students),
        newEnrollments: numeric(kpis.new_enrollments),
        newStudents: numeric(kpis.new_students),
      },
      evolution: readRows(evolutionResult).map((row) => ({
        newEnrollments: numeric(row.new_enrollments),
        newStudents: numeric(row.new_students),
        period: row.period,
      })),
      modalities: dimension(distributions, "modality"),
      previous: {
        newEnrollments: numeric(kpis.previous_new_enrollments),
        newStudents: numeric(kpis.previous_new_students),
      },
      units: dimension(distributions, "unit"),
    };
  }
}

function kpiParams(current, previous) {
  return [
    EnrollmentStatus.ACTIVE,
    EnrollmentStatus.ACTIVE,
    current.startDate,
    current.endDate,
    current.startDate,
    current.endDate,
    previous.startDate,
    previous.endDate,
    previous.startDate,
    previous.endDate,
    current.unitId,
    current.unitId,
  ];
}
function evolutionParams(period) {
  return [period.startDate, period.endDate, period.unitId, period.unitId];
}
function distributionParams(period) {
  return [
    period.endDate,
    "aluno",
    "ACTIVE",
    EnrollmentStatus.ACTIVE,
    period.unitId,
    period.unitId,
    "aluno",
    "ACTIVE",
    EnrollmentStatus.ACTIVE,
    period.unitId,
    period.unitId,
    "aluno",
    EnrollmentStatus.ACTIVE,
    period.unitId,
    period.unitId,
  ];
}
function dimension(rows, type) {
  return rows
    .filter((row) => row.dimension === type)
    .map((row) => ({ key: row.dimension_key, value: numeric(row.value) }));
}
function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  MySqlBiStudentsRepository,
  STUDENT_DISTRIBUTIONS_SQL,
  STUDENT_EVOLUTION_SQL,
  STUDENT_KPIS_SQL,
  distributionParams,
  evolutionParams,
  kpiParams,
};
