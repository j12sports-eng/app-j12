const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../../..");

test("professor scope always comes from the authenticated teacher link", async () => {
  const { resolveTeacherScope } = require("../../../services/teacher-portal.js");
  const scope = await resolveTeacherScope(
    { id: "user-1", role: "professor", teacherId: "teacher-owned" },
    { professorId: "teacher-attacker-selected" },
  );

  assert.equal(scope.professorId, "teacher-owned");
  assert.equal(scope.canManage, false);
  await assert.rejects(
    resolveTeacherScope({ id: "user-2", role: "professor" }, { professorId: "teacher-other" }),
    (error) => error.statusCode === 403,
  );
});

test("teacher portal routes require authentication and resolve scope on every operation", async () => {
  const source = await read("backend/routes/professor-me.js");
  assert.match(source, /router\.use\(requireAuthMiddleware\)/);
  assert.match(source, /service\.resolveTeacherScope\(req\.auth \|\| req\.user/);

  for (const endpoint of [
    'router.get("/agenda"',
    'router.get("/turmas"',
    'router.get("/turmas/:turmaId/alunos"',
    'router.get("/presencas"',
    'router.post("/presencas"',
  ]) {
    assert.ok(source.includes(endpoint), `missing protected endpoint: ${endpoint}`);
  }
});

test("attendance rejects students outside the authorized class before any write", async () => {
  const source = await read("backend/services/teacher-portal.js");
  const start = source.indexOf("async function saveTeacherAttendance");
  const end = source.indexOf("async function loadTeacherDashboard");
  const attendance = source.slice(start, end);

  assert.match(attendance, /loadTeacherClassDetail\(normalizedProfessorId, turmaId/);
  assert.match(attendance, /loadTeacherClassStudents\(normalizedProfessorId, turmaId\)/);
  assert.match(attendance, /if \(!authorizedStudents\.has\(alunoId\)\)/);
  assert.match(attendance, /statusCode|httpError/);
  assert.ok(
    attendance.indexOf("authorizedStudents.has") < attendance.indexOf("UPDATE student_presencas"),
  );
  assert.ok(
    attendance.indexOf("authorizedStudents.has") <
      attendance.indexOf("INSERT INTO student_presencas"),
  );
});

test("evaluations and occurrences validate student membership in an owned class", async () => {
  const source = await read("backend/services/teacher-portal.js");
  const evaluation = between(
    source,
    "async function createTeacherEvaluation",
    "async function loadTeacherOccurrences",
  );
  const occurrence = between(
    source,
    "async function createTeacherOccurrence",
    "async function loadTeacherLessonPlans",
  );

  assert.match(
    evaluation,
    /assertTeacherStudentInClass\(normalizedProfessorId, turmaId, alunoId\)/,
  );
  assert.match(
    occurrence,
    /assertTeacherStudentInClass\(normalizedProfessorId, turmaId, alunoId\)/,
  );
});

test("agenda and lesson-plan updates prove ownership before updating", async () => {
  const source = await read("backend/services/teacher-portal.js");
  const agenda = between(
    source,
    "async function updateTeacherAgendaStatus",
    "async function loadTeacherPresence",
  );
  const planning = between(
    source,
    "async function upsertTeacherLessonPlan",
    "async function loadTeacherMessages",
  );

  assert.match(agenda, /SELECT class_id FROM enrollment_agenda_items WHERE id = \? LIMIT 1/);
  assert.match(agenda, /loadTeacherClassDetail\(normalizedProfessorId, authorizedClassId/);
  assert.match(agenda, /WHERE id = \? AND CAST\(class_id AS CHAR\) = \?/);
  assert.match(planning, /SELECT professor_id FROM teacher_lesson_plans WHERE id = \? LIMIT 1/);
  assert.match(planning, /ownerId !== normalizedProfessorId/);
  assert.match(planning, /Planejamento nao pertence a este professor/);
});

test("teacher attendance frontend consumes only the scoped professor API", async () => {
  const source = await read("src/components/professor/ProfessorPresencasPage.tsx");
  assert.match(source, /api\.get<Turma\[\]>\("\/professor\/me\/turmas"\)/);
  assert.match(
    source,
    /\/professor\/me\/turmas\/\$\{encodeURIComponent\(selectedTurmaId\)\}\/alunos/,
  );
  assert.match(source, /api\.post\("\/professor\/me\/presencas"/);
  assert.doesNotMatch(source, /api\.get<Turma\[\]>\("\/turmas"\)/);
  assert.doesNotMatch(source, /api\.post\("\/presencas"/);
});

function between(source, startMarker, endMarker) {
  return source.slice(source.indexOf(startMarker), source.indexOf(endMarker));
}

function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}
