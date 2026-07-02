const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentClassLinkService,
} = require("../../application/services/enrollment-class-link.service.js");
const {
  createMySqlEnrollmentClassLinkTransactionRunner,
} = require("./mysql-enrollment-class-link.transaction-runner.js");

test("createMySqlEnrollmentClassLinkTransactionRunner persists link with commit and audit metadata", async () => {
  const events = [];
  const facadeCalls = [];
  const sqlCalls = [];
  const transactionRunner = createMySqlEnrollmentClassLinkTransactionRunner({
    classFacadeFactory() {
      return {
        async findActiveClassById(input) {
          facadeCalls.push(["findActiveClassById", input]);
          return {
            id: input.classId,
            name: "Sub-17",
            status: "ativa",
          };
        },
        async ensureClassHasAvailableCapacity(input) {
          facadeCalls.push(["ensureClassHasAvailableCapacity", input]);
          return {
            availableSlots: 1,
            capacityTotal: 2,
            classId: Number(input.classId),
            hasAvailableCapacity: true,
            occupiedSlots: 1,
          };
        },
        async ensureClassOccupancyWithinCapacity(input) {
          facadeCalls.push(["ensureClassOccupancyWithinCapacity", input]);
          return {
            capacityTotal: 2,
            classId: Number(input.classId),
            occupiedSlots: 2,
            occupancyConsistent: true,
          };
        },
      };
    },
    transaction: createFakeTransaction({
      events,
      sqlCalls,
    }),
  });
  const service = new EnrollmentClassLinkService({
    transactionRunner,
  });

  const result = await service.linkActiveEnrollmentToClass({
    classId: 42,
    enrollmentId: "active-enrollment",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, true);
  assert.equal(result.transactional, true);
  assert.equal(result.linkAuditPersisted, true);
  assert.equal(result.link.linkedBy, "admin@j12.local");
  assert.equal(result.classValidation.classValidatedByFacade, true);
  assert.equal(result.classCapacityTransaction.enabled, true);
  assert.equal(result.classCapacityTransaction.recheckedInsideTransaction, true);
  assert.equal(result.classCapacityTransaction.occupiedSlotsConsistent, true);
  assert.deepEqual(facadeCalls, [
    ["findActiveClassById", { classId: 42 }],
    [
      "ensureClassHasAvailableCapacity",
      {
        classId: 42,
        lockForUpdate: true,
        occupancySource: "enrollment_class_links",
      },
    ],
    [
      "ensureClassOccupancyWithinCapacity",
      {
        classId: 42,
        lockForUpdate: true,
        occupancySource: "enrollment_class_links",
      },
    ],
  ]);
  assert.deepEqual(events, ["begin", "commit"]);
  assert.equal(sqlCalls.some((call) => /INSERT INTO enrollment_class_links/.test(call.sql)), true);
  assert.equal(sqlCalls.some((call) => /j12_alunos|financeiro|notificacoes|agenda/i.test(call.sql)), false);
});

test("createMySqlEnrollmentClassLinkTransactionRunner rolls back on link persistence error", async () => {
  const events = [];
  const transactionRunner = createMySqlEnrollmentClassLinkTransactionRunner({
    classFacadeFactory() {
      return {
        async findActiveClassById(input) {
          return {
            id: input.classId,
            name: "Sub-17",
            status: "ativa",
          };
        },
        async ensureClassHasAvailableCapacity(input) {
          return {
            availableSlots: 1,
            capacityTotal: 2,
            classId: Number(input.classId),
            hasAvailableCapacity: true,
            occupiedSlots: 1,
          };
        },
        async ensureClassOccupancyWithinCapacity(input) {
          return {
            capacityTotal: 2,
            classId: Number(input.classId),
            occupiedSlots: 2,
            occupancyConsistent: true,
          };
        },
      };
    },
    transaction: createFakeTransaction({
      events,
      failInsert: true,
    }),
  });
  const service = new EnrollmentClassLinkService({
    transactionRunner,
  });

  await assert.rejects(
    () =>
      service.linkActiveEnrollmentToClass({
        classId: 42,
        enrollmentId: "active-enrollment",
        linkedBy: "admin@j12.local",
      }),
    /simulated insert failure/,
  );

  assert.deepEqual(events, ["begin", "rollback"]);
});

test("createMySqlEnrollmentClassLinkTransactionRunner rolls back when capacity recheck detects overbooking", async () => {
  const events = [];
  const transactionRunner = createMySqlEnrollmentClassLinkTransactionRunner({
    classFacadeFactory() {
      return {
        async findActiveClassById(input) {
          return {
            id: input.classId,
            name: "Sub-17",
            status: "ativa",
          };
        },
        async ensureClassHasAvailableCapacity(input) {
          return {
            availableSlots: 1,
            capacityTotal: 2,
            classId: Number(input.classId),
            hasAvailableCapacity: true,
            occupiedSlots: 1,
          };
        },
        async ensureClassOccupancyWithinCapacity(input) {
          const error = new Error("Class occupancy exceeds configured capacity.");
          error.code = "CLASS_CAPACITY_OVERBOOKED";
          error.details = {
            capacityTotal: 2,
            classId: Number(input.classId),
            occupiedSlots: 3,
          };
          throw error;
        },
      };
    },
    transaction: createFakeTransaction({
      events,
    }),
  });
  const service = new EnrollmentClassLinkService({
    transactionRunner,
  });

  await assert.rejects(
    () =>
      service.linkActiveEnrollmentToClass({
        classId: 42,
        enrollmentId: "active-enrollment",
        linkedBy: "admin@j12.local",
      }),
    {
      code: "ENROLLMENT_CLASS_LINK_CLASS_FULL",
    },
  );

  assert.deepEqual(events, ["begin", "rollback"]);
});

function createFakeTransaction({ events, failInsert = false, sqlCalls = [] } = {}) {
  return async function transaction(work) {
    const connection = createFakeConnection({
      failInsert,
      sqlCalls,
    });

    events.push("begin");

    try {
      const result = await work(connection);
      events.push("commit");
      return result;
    } catch (error) {
      events.push("rollback");
      throw error;
    }
  };
}

function createFakeConnection({ failInsert = false, sqlCalls = [] } = {}) {
  return {
    async execute(sql, params = []) {
      sqlCalls.push({
        params,
        sql,
      });

      if (/FROM enrollments/.test(sql)) {
        return [[
          {
            id: "active-enrollment",
            status: "ACTIVE",
            student_person_id: "person-active",
            student_profile_id: "profile-active",
          },
        ]];
      }

      if (/INSERT INTO enrollment_class_links/.test(sql)) {
        if (failInsert) {
          throw new Error("simulated insert failure");
        }

        return [{ affectedRows: 1 }];
      }

      if (/WHERE id = \?/.test(sql) && /FROM enrollment_class_links/.test(sql)) {
        return [[
          {
            class_id: 42,
            enrollment_id: "active-enrollment",
            id: params[0],
            linked_at: "2026-07-01 10:00:00",
            linked_by: "admin@j12.local",
            status: "ACTIVE",
          },
        ]];
      }

      if (/FROM enrollment_class_links/.test(sql)) {
        return [[]];
      }

      return [[]];
    },
  };
}
