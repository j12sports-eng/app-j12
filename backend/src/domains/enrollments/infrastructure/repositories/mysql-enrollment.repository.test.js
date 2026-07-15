const assert = require("node:assert/strict");
const test = require("node:test");

const { MySqlEnrollmentRepository } = require("./mysql-enrollment.repository.js");

test("MySqlEnrollmentRepository embeds only a normalized search limit", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [];
    },
  });

  await repository.searchStudentScopes({ query: "Aluno Jornada", limit: 999 });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /LIMIT 25/);
  assert.doesNotMatch(calls[0].sql, /LIMIT \?/);
  assert.equal(calls[0].params.length, 8);
});
