const assert = require("node:assert/strict");
const test = require("node:test");

const { ClassFacade } = require("../facades/class.facade.js");

test("ClassFacade delegates read-only operations to the application service", async () => {
  const calls = [];
  const facade = new ClassFacade({
    classService: {
      findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return Promise.resolve({ delegated: "findActiveClassById" });
      },
      findClassById(input) {
        calls.push(["findClassById", input]);
        return Promise.resolve({ delegated: "findClassById" });
      },
      getClassCapacitySummary(input) {
        calls.push(["getClassCapacitySummary", input]);
        return Promise.resolve({ delegated: "getClassCapacitySummary" });
      },
      ensureClassHasAvailableCapacity(input) {
        calls.push(["ensureClassHasAvailableCapacity", input]);
        return Promise.resolve({ delegated: "ensureClassHasAvailableCapacity" });
      },
      ensureClassOccupancyWithinCapacity(input) {
        calls.push(["ensureClassOccupancyWithinCapacity", input]);
        return Promise.resolve({ delegated: "ensureClassOccupancyWithinCapacity" });
      },
    },
  });

  assert.deepEqual(await facade.findClassById({ classId: "1" }), {
    delegated: "findClassById",
  });
  assert.deepEqual(await facade.findActiveClassById({ classId: "1" }), {
    delegated: "findActiveClassById",
  });
  assert.deepEqual(await facade.getClassCapacitySummary({ classId: "1" }), {
    delegated: "getClassCapacitySummary",
  });
  assert.deepEqual(await facade.ensureClassHasAvailableCapacity({ classId: "1" }), {
    delegated: "ensureClassHasAvailableCapacity",
  });
  assert.deepEqual(await facade.ensureClassOccupancyWithinCapacity({ classId: "1" }), {
    delegated: "ensureClassOccupancyWithinCapacity",
  });
  assert.deepEqual(calls, [
    ["findClassById", { classId: "1" }],
    ["findActiveClassById", { classId: "1" }],
    ["getClassCapacitySummary", { classId: "1" }],
    ["ensureClassHasAvailableCapacity", { classId: "1" }],
    ["ensureClassOccupancyWithinCapacity", { classId: "1" }],
  ]);
});
