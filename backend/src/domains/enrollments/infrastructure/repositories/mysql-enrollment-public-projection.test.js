const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MySqlEnrollmentRepository,
  SELECT_PUBLIC_ENROLLMENT_BY_ID_SQL,
} = require("./mysql-enrollment.repository.js");

test("MySqlEnrollmentRepository public projection is unit-scoped and allowlisted", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        [
          {
            enrollment_id: "draft-1",
            status: "DRAFT",
            student_birth_date: "2014-05-06",
            student_gender: "M",
            student_name: "Aluno Publico",
            unit_id: "12",
          },
        ],
        [],
      ];
    },
  });

  const result = await repository.findPublicById({ enrollmentId: "draft-1", unitId: "12" });

  assert.deepEqual(calls, [
    {
      params: ["draft-1", "12"],
      sql: SELECT_PUBLIC_ENROLLMENT_BY_ID_SQL,
    },
  ]);
  assert.match(SELECT_PUBLIC_ENROLLMENT_BY_ID_SQL, /enrollment\.unit_id = \?/u);
  assert.doesNotMatch(
    SELECT_PUBLIC_ENROLLMENT_BY_ID_SQL,
    /created_by|confirmed_by|responsible|token_hash|metadata_json/iu,
  );
  assert.deepEqual(result, {
    enrollmentId: "draft-1",
    status: "DRAFT",
    student: { birthDate: "2014-05-06", gender: "M", name: "Aluno Publico" },
    unitId: "12",
  });
});
