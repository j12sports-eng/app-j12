const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DigitalEnrollmentProgress,
} = require("../../domain/entities/digital-enrollment-progress.entity.js");
const {
  MemoryDigitalEnrollmentProgressRepository,
} = require("../../infrastructure/repositories/memory-digital-enrollment-progress.repository.js");

test("progress starts once at revision one without PII", async () => {
  const repository = new MemoryDigitalEnrollmentProgressRepository();
  const first = await repository.ensureProgressForEnrollment({
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
  });
  const second = await repository.ensureProgressForEnrollment({
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
  });
  assert.equal(first.progress.status, "NOT_STARTED");
  assert.equal(first.progress.revision, 1);
  assert.equal(second.created, false);
  assert.equal(JSON.stringify(first).match(/cpf|email|phone|tokenHash/), null);
});

test("optimistic update increments revision and only one concurrent write wins", async () => {
  const repository = new MemoryDigitalEnrollmentProgressRepository();
  await repository.ensureProgressForEnrollment({
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
  });
  const results = await Promise.allSettled([
    repository.updateIfRevisionMatches({
      enrollmentId: "enrollment-1",
      expectedRevision: 1,
      patch: { status: "IN_PROGRESS" },
      responsibleRelationshipId: "relationship-1",
    }),
    repository.updateIfRevisionMatches({
      enrollmentId: "enrollment-1",
      expectedRevision: 1,
      patch: { status: "IN_PROGRESS" },
      responsibleRelationshipId: "relationship-1",
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("progress rejects unsupported steps and premature review", () => {
  assert.throws(
    () =>
      new DigitalEnrollmentProgress({
        completedSteps: ["CONTRACT"],
        enrollmentId: "enrollment-1",
        responsibleRelationshipId: "relationship-1",
      }),
    /completedSteps/,
  );
  assert.throws(
    () =>
      new DigitalEnrollmentProgress({
        enrollmentId: "enrollment-1",
        responsibleRelationshipId: "relationship-1",
        status: "READY_FOR_REVIEW",
      }),
    /requires every editable step/,
  );
});
