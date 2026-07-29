const assert = require("node:assert/strict");
const test = require("node:test");

const { Enrollment } = require("./enrollment.entity.js");
const { EnrollmentFactory } = require("../factories/enrollment.factory.js");

function draftInput(overrides = {}) {
  return {
    startDate: "2026-08-01",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    ...overrides,
  };
}

test("modern DRAFT accepts canonical unitId 1", () => {
  const enrollment = EnrollmentFactory.createDraft(draftInput({ unitId: "1" }));

  assert.equal(enrollment.unitId, "1");
  assert.equal(enrollment.status, "DRAFT");
});

test("modern DRAFT preserves the exact maximum signed BIGINT string", () => {
  const unitId = "9223372036854775807";
  const enrollment = EnrollmentFactory.createDraft(draftInput({ unitId }));

  assert.equal(enrollment.unitId, unitId);
  assert.equal(typeof enrollment.unitId, "string");
});

test("Enrollment serialization exposes unitId", () => {
  const enrollment = EnrollmentFactory.createDraft(draftInput({ unitId: "12" }));

  assert.equal(enrollment.toJSON().unitId, "12");
});

test("legacy hydration accepts unitId null", () => {
  const enrollment = new Enrollment({
    ...draftInput(),
    unitId: null,
  });

  assert.equal(enrollment.unitId, null);
  assert.equal(enrollment.toJSON().unitId, null);
});

test("legacy hydration remains compatible when unitId is absent", () => {
  const enrollment = new Enrollment(draftInput());

  assert.equal(enrollment.unitId, null);
});

test("modern DRAFT rejects missing unitId", () => {
  assert.throws(() => EnrollmentFactory.createDraft(draftInput()), /requires unitId/);
});

const INVALID_UNIT_IDS = Object.freeze([
  "",
  " ",
  " 1",
  "1 ",
  "0",
  "-1",
  "1.5",
  "1e3",
  "ABC",
  "123456789012345678901",
]);

for (const value of INVALID_UNIT_IDS) {
  test(`modern DRAFT rejects invalid unitId ${JSON.stringify(value)}`, () => {
    assert.throws(
      () => EnrollmentFactory.createDraft(draftInput({ unitId: value })),
      /unitId has an invalid format/,
    );
  });
}

test("modern DRAFT rejects numeric unitId", () => {
  assert.throws(
    () => EnrollmentFactory.createDraft(draftInput({ unitId: 1 })),
    /unitId has an invalid format/,
  );
});

test("modern DRAFT rejects BigInt unitId", () => {
  assert.throws(
    () => EnrollmentFactory.createDraft(draftInput({ unitId: 1n })),
    /unitId has an invalid format/,
  );
});

test("existing Enrollment state transitions remain unchanged", () => {
  const enrollment = EnrollmentFactory.createDraft(draftInput({ unitId: "7" }));

  enrollment.activate({
    startDate: "2026-08-02",
    updatedAt: "2026-08-01T12:00:00.000Z",
  });
  assert.equal(enrollment.status, "ACTIVE");
  assert.equal(enrollment.unitId, "7");

  enrollment.suspend({ updatedAt: "2026-08-03T12:00:00.000Z" });
  assert.equal(enrollment.status, "SUSPENDED");
  assert.equal(enrollment.unitId, "7");

  enrollment.cancel({
    endDate: "2026-08-04",
    updatedAt: "2026-08-04T12:00:00.000Z",
  });
  assert.equal(enrollment.status, "CANCELLED");
  assert.equal(enrollment.unitId, "7");
});
