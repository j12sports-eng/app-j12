const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE,
  MySqlEnrollmentRepository,
  SELECT_DRAFT_OPENING_OWNERSHIP_SQL,
} = require("./mysql-enrollment.repository.js");

test("resolveDraftOpeningOwnership is unit-scoped and returns canonical internal ownership", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        {
          responsible_person_id: "responsible-1",
          responsible_profile_id: "responsible-profile-1",
          responsible_relationship_id: "relationship-1",
          student_person_id: "student-1",
          student_profile_id: "student-profile-1",
          unit_id: "12",
        },
      ];
    },
  });
  const result = await repository.resolveDraftOpeningOwnership({
    responsiblePersonId: "responsible-1",
    studentPersonId: "student-1",
    unitId: "12",
  });

  assert.equal(calls[0].sql, SELECT_DRAFT_OPENING_OWNERSHIP_SQL);
  assert.deepEqual(calls[0].params, ["responsible-1", "student-1", "12"]);
  assert.deepEqual(result, {
    responsiblePersonId: "responsible-1",
    responsibleProfileId: "responsible-profile-1",
    responsibleRelationshipId: "relationship-1",
    studentPersonId: "student-1",
    studentProfileId: "student-profile-1",
    unitId: "12",
  });
  assert.equal(Object.isFrozen(result), true);
});

test("resolveDraftOpeningOwnership rejects missing, ambiguous and cross-unit ownership", async (t) => {
  const invalidRows = [
    [],
    [{ unit_id: "12" }, { unit_id: "12" }],
    [{ responsible_person_id: "responsible-1", student_person_id: "student-1", unit_id: "13" }],
  ];
  for (const rows of invalidRows) {
    await t.test(String(rows.length), async () => {
      const repository = new MySqlEnrollmentRepository({ queryRunner: async () => rows });
      await assert.rejects(
        () =>
          repository.resolveDraftOpeningOwnership({
            responsiblePersonId: "responsible-1",
            studentPersonId: "student-1",
            unitId: "12",
          }),
        { code: ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE },
      );
    });
  }
});
