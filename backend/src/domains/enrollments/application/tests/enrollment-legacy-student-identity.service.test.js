const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_IDENTITY_DUPLICATE,
  ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND,
  ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND,
  ENROLLMENT_IDENTITY_PERSON_NOT_FOUND,
  ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND,
  EnrollmentLegacyStudentIdentityService,
} = require("../services/enrollment-legacy-student-identity.service.js");
const {
  MySqlEnrollmentLegacyStudentIdentityRepository,
  RESOLVE_ENROLLMENT_LEGACY_STUDENT_IDENTITY_SQL,
} = require("../../infrastructure/repositories/mysql-enrollment-legacy-student-identity.repository.js");

const ENROLLMENT = Object.freeze({
  id: "enrollment-1",
  legacyStudentId: "legacy-1",
  studentPersonId: "person-1",
  studentProfileId: "profile-1",
});
const RESOLVED = Object.freeze({
  enrollmentId: "enrollment-1",
  legacyStudentId: "legacy-1",
  personId: "person-1",
  profileId: "profile-1",
});

test("resolves a valid Enrollment identity deterministically", async () => {
  const service = createService([RESOLVED]);

  assert.deepEqual(await service.resolve(ENROLLMENT), {
    enrollment_id: "enrollment-1",
    legacy_student_id: "legacy-1",
    person_id: "person-1",
    profile_id: "profile-1",
  });
});

test("rejects an Enrollment that does not exist", async () => {
  await assertCode(
    createService([without("enrollmentId")]).resolve(ENROLLMENT),
    ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND,
  );
});

test("rejects a Person that does not exist", async () => {
  await assertCode(
    createService([without("personId")]).resolve(ENROLLMENT),
    ENROLLMENT_IDENTITY_PERSON_NOT_FOUND,
  );
});

test("rejects a Profile that does not exist or does not belong to Person", async () => {
  await assertCode(
    createService([without("profileId")]).resolve(ENROLLMENT),
    ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND,
  );
});

test("rejects an explicit legacy student that does not exist", async () => {
  await assertCode(
    createService([without("legacyStudentId")]).resolve(ENROLLMENT),
    ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND,
  );
});

test("rejects duplicate identity results", async () => {
  await assertCode(
    createService([RESOLVED, RESOLVED]).resolve(ENROLLMENT),
    ENROLLMENT_IDENTITY_DUPLICATE,
  );
});

test("returns the same frozen identity for repeated resolutions", async () => {
  const service = createService([RESOLVED]);
  const first = await service.resolve(ENROLLMENT);
  const second = await service.resolve({ ...ENROLLMENT });

  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(second), true);
});

test("repository performs one canonical read with explicit identifiers", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentLegacyStudentIdentityRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [
        {
          enrollment_id: "enrollment-1",
          legacy_student_id: "legacy-1",
          person_id: "person-1",
          profile_id: "profile-1",
        },
      ];
    },
  });

  assert.deepEqual(await repository.resolveEnrollmentLegacyStudentIdentity(RESOLVED), [RESOLVED]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["enrollment-1", "person-1", "profile-1", "legacy-1"]);
  assert.equal(calls[0].sql, RESOLVE_ENROLLMENT_LEGACY_STUDENT_IDENTITY_SQL);
  assert.match(calls[0].sql, /LEFT JOIN people person/);
  assert.match(calls[0].sql, /LEFT JOIN person_profiles profile/);
  assert.match(calls[0].sql, /LEFT JOIN j12_alunos legacy_student/);
  assert.doesNotMatch(calls[0].sql, /cpf|email|nome_completo/i);
});

function createService(result) {
  return new EnrollmentLegacyStudentIdentityService({
    identityReader: {
      async resolveEnrollmentLegacyStudentIdentity() {
        return result;
      },
    },
  });
}

function without(field) {
  return { ...RESOLVED, [field]: null };
}

async function assertCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}
