const assert = require("node:assert/strict");
const test = require("node:test");
const { DigitalEnrollmentFormGateway } = require("./digital-enrollment-form.gateway.js");

test("gateway loads one consistent DRAFT aggregate through its transaction", async () => {
  const gateway = fixture();
  const aggregate = await gateway.executeDigitalEnrollmentOperation({
    invitation: { enrollmentId: "enrollment-1" },
    operation: "getForm",
  });
  assert.equal(aggregate.enrollment.status, "DRAFT");
  assert.equal(aggregate.progress.revision, 1);
});

test("gateway fails closed for old DRAFT without ownership", async () => {
  const gateway = fixture({
    enrollment: {
      id: "enrollment-1",
      status: "DRAFT",
      studentPersonId: "student-1",
    },
  });
  await assert.rejects(
    () =>
      gateway.executeDigitalEnrollmentOperation({
        invitation: { enrollmentId: "enrollment-1" },
        operation: "getForm",
      }),
    { code: "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE" },
  );
});

test("gateway keeps every public write operation blocked", async () => {
  const gateway = fixture();
  await assert.rejects(
    () =>
      gateway.executeDigitalEnrollmentOperation({
        invitation: { enrollmentId: "enrollment-1" },
        operation: "updateResponsible",
      }),
    { code: "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE" },
  );
});

function fixture(overrides = {}) {
  const enrollment = overrides.enrollment || {
    id: "enrollment-1",
    responsiblePersonId: "responsible-1",
    responsibleRelationshipId: "relationship-1",
    status: "DRAFT",
    studentPersonId: "student-1",
  };
  return new DigitalEnrollmentFormGateway({
    enrollmentRepository: {
      async findById() {
        return enrollment;
      },
    },
    progressRepository: {
      async findByEnrollmentId() {
        return {
          enrollmentId: "enrollment-1",
          responsibleRelationshipId: "relationship-1",
          revision: 1,
        };
      },
    },
    relationshipRepository: {
      async findById() {
        return {
          personId: "responsible-1",
          relatedPersonId: "student-1",
          status: "active",
        };
      },
    },
    transactionRunner: async (callback) => callback(async () => []),
  });
}
