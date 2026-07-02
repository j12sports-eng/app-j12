const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MySqlClassRepository,
  selectCapacitySnapshotSql,
} = require("./mysql-class.repository.js");

test("MySqlClassRepository can count occupancy from enrollment_class_links with FOR UPDATE", async () => {
  const calls = [];
  const repository = new MySqlClassRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [
        {
          capacidade: 3,
          current_student_count: 2,
          id: 7,
          nome: "Sub-13",
          status: "ativa",
        },
      ];
    },
  });

  const result = await repository.getClassCapacitySnapshot({
    classId: 7,
    lockForUpdate: true,
    occupancySource: "enrollment_class_links",
  });

  assert.equal(result.capacity, 3);
  assert.equal(result.currentStudentCount, 2);
  assert.equal(result.lockForUpdate, true);
  assert.equal(result.occupancySource, "enrollment_class_links");
  assert.equal(result.studentCountSource, "enrollment_class_links ACTIVE links");
  assert.match(calls[0].sql, /FROM enrollment_class_links link/);
  assert.match(calls[0].sql, /FOR UPDATE\s*$/);
  assert.deepEqual(calls[0].params, [7]);
});

test("selectCapacitySnapshotSql keeps the legacy j12_alunos source by default", () => {
  const sql = selectCapacitySnapshotSql();

  assert.match(sql, /FROM j12_alunos aluno/);
  assert.doesNotMatch(sql, /enrollment_class_links/);
  assert.doesNotMatch(sql, /FOR UPDATE\s*$/);
});
