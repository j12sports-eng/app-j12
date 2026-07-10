const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  BI_CLASSES_SQL,
  BI_ENROLLED_STUDENTS_SQL,
  MySqlBiClassesRepository,
  classParams,
} = require("./mysql-bi-classes.repository.js");
test("class repository performs two parallel parameterized aggregate reads without N+1", async () => {
  const calls = [];
  const repository = new MySqlBiClassesRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.getClassOccupancy({ current: { unitId: "3" } });
  assert.equal(calls.length, 2);
  assert.equal(classParams({ unitId: "3" }).length, (BI_CLASSES_SQL.match(/\?/g) || []).length);
  assert.doesNotMatch(BI_CLASSES_SQL, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.equal(
    classParams({ unitId: "3" }).length,
    (BI_ENROLLED_STUDENTS_SQL.match(/\?/g) || []).length,
  );
  assert.match(BI_ENROLLED_STUDENTS_SQL, /COUNT\(DISTINCT enrollment\.student_person_id\)/);
  assert.match(BI_ENROLLED_STUDENTS_SQL, /turma\.status[\s\S]*'ativa'/);
});
test("occupancy requires active unique enrollments and active non-deleted links", () => {
  assert.match(BI_CLASSES_SQL, /COUNT\(DISTINCT CASE/);
  assert.match(BI_CLASSES_SQL, /link\.status=\?/);
  assert.match(BI_CLASSES_SQL, /link\.unlinked_at IS NULL/);
  assert.match(BI_CLASSES_SQL, /enrollment\.status=\?/);
  assert.match(BI_CLASSES_SQL, /enrollment\.deleted_at IS NULL/);
});
test("repository maps canonical class capacity schedule and null capacity", async () => {
  const repository = new MySqlBiClassesRepository({
    async queryRunner() {
      return [
        [
          {
            id: 1,
            nome: "Sub 12",
            status: "ativa",
            capacidade: null,
            occupancy: "4",
            dias_semana_json: '["segunda","quarta"]',
          },
        ],
      ];
    },
  });
  const result = await repository.getClassOccupancy({ current: { unitId: null } });
  const [classResult] = result.classes;
  assert.equal(classResult.capacity, null);
  assert.equal(classResult.occupancy, 4);
  assert.deepEqual(classResult.daysOfWeek, ["segunda", "quarta"]);
});
