const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MySqlBiStudentsRepository,
  STUDENT_DISTRIBUTIONS_SQL,
  STUDENT_EVOLUTION_SQL,
  STUDENT_KPIS_SQL,
  distributionParams,
  evolutionParams,
  kpiParams,
} = require("./mysql-bi-students.repository.js");
test("student repository runs three parameterized aggregate reads without N+1", async () => {
  const calls = [];
  const repository = new MySqlBiStudentsRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[{}]];
    },
  });
  await repository.getStudentAnalytics({
    current: period("2026-07-01", "2026-07-31", "2"),
    previous: period("2026-06-01", "2026-06-30", "2"),
  });
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every(({ sql }) => /COUNT\(/.test(sql) && !/\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql)),
  );
});
test("SQL prevents duplicates from multiple enrollments and class links", () => {
  assert.match(
    STUDENT_KPIS_SQL,
    /COUNT\(DISTINCT CASE WHEN e\.status = \? THEN e\.student_person_id END\)/,
  );
  assert.match(STUDENT_KPIS_SQL, /COUNT\(DISTINCT CASE WHEN e\.status = \? THEN e\.id END\)/);
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /COUNT\(DISTINCT e\.student_person_id\)/);
  assert.match(STUDENT_KPIS_SQL, /NOT EXISTS[\s\S]*earlier\.confirmed_at < e\.confirmed_at/);
});
test("student repository maps counts, evolution and distributions without PII", async () => {
  let call = 0;
  const repository = new MySqlBiStudentsRepository({
    async queryRunner() {
      call += 1;
      if (call === 1)
        return [
          [
            {
              active_students: "8",
              active_enrollments: "11",
              new_students: "3",
              new_enrollments: "5",
              previous_new_students: "2",
              previous_new_enrollments: "3",
            },
          ],
        ];
      if (call === 2) return [[{ period: "2026-07", new_students: "3", new_enrollments: "5" }]];
      return [
        [
          { dimension: "age", dimension_key: "12-17", value: "4" },
          { dimension: "unit", dimension_key: "centro", value: "8" },
        ],
      ];
    },
  });
  const result = await repository.getStudentAnalytics({
    current: period("2026-07-01", "2026-07-31"),
    previous: period("2026-06-01", "2026-06-30"),
  });
  assert.equal(result.current.activeStudents, 8);
  assert.deepEqual(result.ageGroups, [{ key: "12-17", value: 4 }]);
  assert.equal(JSON.stringify(result).match(/nome|cpf|email|telefone|data_nascimento/i), null);
});
test("student query params match placeholders and unit filter", () => {
  const current = period("2026-07-01", "2026-07-31", "9"),
    previous = period("2026-06-01", "2026-06-30", "9");
  assert.equal(kpiParams(current, previous).length, 12);
  assert.equal(evolutionParams(current).length, 4);
  assert.equal(distributionParams(current).length, 15);
  assert.equal(kpiParams(current, previous).length, (STUDENT_KPIS_SQL.match(/\?/g) || []).length);
  assert.equal(evolutionParams(current).length, (STUDENT_EVOLUTION_SQL.match(/\?/g) || []).length);
  assert.equal(
    distributionParams(current).length,
    (STUDENT_DISTRIBUTIONS_SQL.match(/\?/g) || []).length,
  );
  assert.ok(distributionParams(current).includes("9"));
});
test("student SQL uses canonical active links, active status, soft-delete and deterministic age reference", () => {
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /link\.status=\?/);
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /e\.status=\?/);
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /e\.deleted_at IS NULL/);
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /people person|people\s+person/);
  assert.match(STUDENT_DISTRIBUTIONS_SQL, /NOT BETWEEN 0 AND 120/);
  assert.equal(distributionParams(period("2026-07-01", "2026-07-31"))[0], "2026-07-31");
});
test("new student is based on the person's first known confirmation, unlike new enrollment", () => {
  assert.match(
    STUDENT_KPIS_SQL,
    /NOT EXISTS[\s\S]*earlier\.student_person_id=e\.student_person_id[\s\S]*earlier\.confirmed_at < e\.confirmed_at/,
  );
  assert.match(STUDENT_KPIS_SQL, /new_students/);
  assert.match(STUDENT_KPIS_SQL, /THEN e\.id END\) new_enrollments/);
});
function period(startDate, endDate, unitId = null) {
  return { endDate, startDate, unitId };
}
