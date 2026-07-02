const assert = require("node:assert/strict");
const test = require("node:test");

const { AgendaFacade } = require("../facades/agenda.facade.js");

test("AgendaFacade delegates read-only operations to application service", async () => {
  const calls = [];
  const facade = new AgendaFacade({
    agendaService: {
      findSchedulesByClass(input) {
        calls.push(["findSchedulesByClass", input]);
        return Promise.resolve([{ delegated: "findSchedulesByClass" }]);
      },
      findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return Promise.resolve([{ delegated: "findSchedulesByEnrollment" }]);
      },
      findSchedulesByStudent(input) {
        calls.push(["findSchedulesByStudent", input]);
        return Promise.resolve([{ delegated: "findSchedulesByStudent" }]);
      },
      getAgendaSummaryByStudent(input) {
        calls.push(["getAgendaSummaryByStudent", input]);
        return Promise.resolve({ delegated: "getAgendaSummaryByStudent" });
      },
      getEnrollmentAgendaSummary(input) {
        calls.push(["getEnrollmentAgendaSummary", input]);
        return Promise.resolve({ delegated: "getEnrollmentAgendaSummary" });
      },
      prepareInitialAgendaForEnrollment(input) {
        calls.push(["prepareInitialAgendaForEnrollment", input]);
        return Promise.resolve({ delegated: "prepareInitialAgendaForEnrollment" });
      },
      createInitialAgendaForEnrollment(input) {
        calls.push(["createInitialAgendaForEnrollment", input]);
        return Promise.resolve({ delegated: "createInitialAgendaForEnrollment" });
      },
    },
  });

  assert.deepEqual(await facade.findSchedulesByClass({ classId: "7" }), [
    { delegated: "findSchedulesByClass" },
  ]);
  assert.deepEqual(await facade.findSchedulesByEnrollment({ enrollmentId: "enr-1" }), [
    { delegated: "findSchedulesByEnrollment" },
  ]);
  assert.deepEqual(
    await facade.findSchedulesByStudent({
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
    }),
    [{ delegated: "findSchedulesByStudent" }],
  );
  assert.deepEqual(
    await facade.getAgendaSummaryByStudent({
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
    }),
    { delegated: "getAgendaSummaryByStudent" },
  );
  assert.deepEqual(await facade.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" }), {
    delegated: "getEnrollmentAgendaSummary",
  });
  assert.deepEqual(
    await facade.prepareInitialAgendaForEnrollment({
      enrollmentId: "enr-1",
      requestedBy: "admin-1",
    }),
    { delegated: "prepareInitialAgendaForEnrollment" },
  );
  assert.deepEqual(
    await facade.createInitialAgendaForEnrollment({
      enrollmentId: "enr-1",
      requestedBy: "admin-1",
    }),
    { delegated: "createInitialAgendaForEnrollment" },
  );
  assert.deepEqual(calls, [
    ["findSchedulesByClass", { classId: "7" }],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    [
      "findSchedulesByStudent",
      {
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
    ],
    [
      "getAgendaSummaryByStudent",
      {
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
    ],
    ["getEnrollmentAgendaSummary", { enrollmentId: "enr-1" }],
    [
      "prepareInitialAgendaForEnrollment",
      {
        enrollmentId: "enr-1",
        requestedBy: "admin-1",
      },
    ],
    [
      "createInitialAgendaForEnrollment",
      {
        enrollmentId: "enr-1",
        requestedBy: "admin-1",
      },
    ],
  ]);
});

test("AgendaFacade forwards EnrollmentFacade and ClassFacade to the default service", async () => {
  const calls = [];
  const facade = new AgendaFacade({
    agendaRepository: {
      async findSchedulesByClass() {
        return [];
      },
      async findSchedulesByEnrollment(input) {
        calls.push(["findSchedulesByEnrollment", input]);
        return [
          {
            classId: 9,
            enrollmentId: input.enrollmentId,
            readOnly: true,
          },
        ];
      },
      async findSchedulesByStudent() {
        return [];
      },
    },
    classFacade: {
      async findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return { active: true, id: input.classId };
      },
    },
    enrollmentFacade: {
      async findEnrollmentById(id) {
        calls.push(["findEnrollmentById", id]);
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
        };
      },
    },
  });

  const summary = await facade.getEnrollmentAgendaSummary({ enrollmentId: "enr-1" });

  assert.equal(summary.hasSchedule, true);
  assert.equal(summary.classId, 9);
  assert.equal(summary.usesEnrollmentFacade, true);
  assert.equal(summary.usesClassFacade, true);
  assert.deepEqual(calls, [
    ["findEnrollmentById", "enr-1"],
    ["findSchedulesByEnrollment", { enrollmentId: "enr-1" }],
    ["findActiveClassById", { classId: 9 }],
  ]);
});
