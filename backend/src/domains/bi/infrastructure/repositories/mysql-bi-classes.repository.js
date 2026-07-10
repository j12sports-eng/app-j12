const { BiReadRepositoryContract } = require("../../application/index.js");
const { EnrollmentStatus } = require("../../../enrollments/domain/enums/enrollment-status.enum.js");

const BI_CLASSES_SQL = `
  SELECT turma.id, turma.nome, turma.status, turma.capacidade,
    turma.modalidade, turma.modalidade_id, turma.unidade, turma.unidade_id,
    turma.professor_id, COALESCE(professor.nome,turma.professor_nome) professor_nome,
    turma.dias_semana_json, turma.dias_semana,
    COALESCE(turma.horario_inicio,turma.horario) horario_inicio, turma.horario_fim,
    COUNT(DISTINCT CASE WHEN link.status=? AND link.unlinked_at IS NULL
      AND enrollment.status=? AND enrollment.deleted_at IS NULL THEN link.enrollment_id END) occupancy
  FROM j12_turmas turma
  LEFT JOIN j12_professores professor ON professor.id=turma.professor_id
  LEFT JOIN enrollment_class_links link ON link.class_id=turma.id
  LEFT JOIN enrollments enrollment ON enrollment.id=link.enrollment_id
  WHERE (? IS NULL OR CAST(turma.unidade_id AS CHAR)=?)
  GROUP BY turma.id, turma.nome, turma.status, turma.capacidade,
    turma.modalidade, turma.modalidade_id, turma.unidade, turma.unidade_id,
    turma.professor_id, professor.nome, turma.professor_nome,
    turma.dias_semana_json, turma.dias_semana, turma.horario_inicio, turma.horario,
    turma.horario_fim
  ORDER BY turma.nome, turma.id
`;
const BI_ENROLLED_STUDENTS_SQL = `
  SELECT COUNT(DISTINCT enrollment.student_person_id) enrolled_students
  FROM enrollment_class_links link
  INNER JOIN enrollments enrollment ON enrollment.id=link.enrollment_id
  INNER JOIN j12_turmas turma ON turma.id=link.class_id
  WHERE link.status=? AND link.unlinked_at IS NULL
    AND enrollment.status=? AND enrollment.deleted_at IS NULL
    AND LOWER(COALESCE(turma.status,'')) IN ('ativa','ativo','active')
    AND (? IS NULL OR CAST(turma.unidade_id AS CHAR)=?)
`;

class MySqlBiClassesRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getClassOccupancy({ current }) {
    const [classesResult, studentsResult] = await Promise.all([
      this.query(BI_CLASSES_SQL, classParams(current)),
      this.query(BI_ENROLLED_STUDENTS_SQL, classParams(current)),
    ]);
    return {
      classes: readRows(classesResult).map(toClassSnapshot),
      enrolledStudents: nonNegative(readRows(studentsResult)[0]?.enrolled_students),
    };
  }
}

function classParams(period) {
  return ["ACTIVE", EnrollmentStatus.ACTIVE, period.unitId, period.unitId];
}

function toClassSnapshot(row = {}) {
  return {
    capacity: optionalNonNegative(row.capacidade),
    classId: text(row.id),
    className: text(row.nome),
    daysOfWeek: parseDays(row.dias_semana_json, row.dias_semana),
    endTime: nullableText(row.horario_fim),
    modality: nullableText(row.modalidade),
    modalityId: nullableText(row.modalidade_id),
    occupancy: nonNegative(row.occupancy),
    professorId: nullableText(row.professor_id),
    professorName: nullableText(row.professor_nome),
    startTime: nullableText(row.horario_inicio),
    status: nullableText(row.status),
    unit: nullableText(row.unidade),
    unitId: nullableText(row.unidade_id),
  };
}

function parseDays(json, legacy) {
  try {
    const parsed = JSON.parse(String(json || ""));
    if (Array.isArray(parsed)) return unique(parsed);
  } catch {
    // Legacy values are slash/comma separated.
  }
  return unique(
    String(legacy || "")
      .replace(/\./g, "")
      .split(/[\/,;|]/),
  );
}
function unique(values) {
  return [...new Set(values.map((value) => text(value).trim()).filter(Boolean))];
}
function optionalNonNegative(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}
function nonNegative(value) {
  return optionalNonNegative(value) ?? 0;
}
function nullableText(value) {
  const valueText = text(value).trim();
  return valueText || null;
}
function text(value) {
  return value == null ? "" : String(value);
}
function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  BI_CLASSES_SQL,
  BI_ENROLLED_STUDENTS_SQL,
  MySqlBiClassesRepository,
  classParams,
  toClassSnapshot,
};
