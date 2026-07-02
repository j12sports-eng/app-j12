const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ClassApplicationService,
} = require("../services/class-application.service.js");

test("ClassApplicationService returns null for invalid class ids without touching repository", async () => {
  let calls = 0;
  const service = new ClassApplicationService({
    classRepository: {
      async findById() {
        calls += 1;
        return null;
      },
    },
  });

  assert.equal(await service.findClassById({ classId: "abc" }), null);
  assert.equal(await service.findActiveClassById({ classId: "" }), null);
  assert.equal(await service.getClassCapacitySummary({ classId: null }), null);
  assert.equal(calls, 0);
});

test("ClassApplicationService reads class and active class through repository", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findActiveById({ classId }) {
        return {
          classId,
          name: "Sub-11",
          status: "ativa",
        };
      },
      async findById({ classId }) {
        return {
          classId,
          name: "Sub-11",
          status: "ativa",
        };
      },
    },
  });

  assert.deepEqual(await service.findClassById({ classId: "10" }), {
    classId: 10,
    name: "Sub-11",
    status: "ativa",
  });
  assert.deepEqual(await service.findActiveClassById({ classId: 10 }), {
    classId: 10,
    name: "Sub-11",
    status: "ativa",
  });
});

test("ClassApplicationService prepares capacity summary from read-only snapshot", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findById() {
        throw new Error("findById should not be called when snapshot has classRecord.");
      },
      async getClassCapacitySnapshot({ classId }) {
        return {
          capacity: 20,
          classId,
          classRecord: {
            classId,
            name: "Sub-13",
            status: "ativa",
          },
          currentStudentCount: 12,
        };
      },
    },
  });

  assert.deepEqual(await service.getClassCapacitySummary({ classId: "7" }), {
    active: true,
    availableCapacity: 8,
    availableSlots: 8,
    capacity: 20,
    capacityConfigured: true,
    capacitySource: "j12_turmas.capacidade + active j12_alunos links",
    capacityTotal: 20,
    classId: 7,
    className: "Sub-13",
    currentStudentCount: 12,
    full: false,
    hasAvailableCapacity: true,
    occupiedSlots: 12,
    source: {
      capacityField: "j12_turmas.capacidade",
      studentCountSource: "j12_alunos.turma_id OR j12_alunos.turma_principal",
    },
    status: "ativa",
  });
});

test("ClassApplicationService documents missing capacity configuration", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findById({ classId }) {
        return {
          classId,
          name: "Livre",
          status: "ativa",
        };
      },
      async getClassCapacitySnapshot() {
        return null;
      },
    },
  });

  const summary = await service.getClassCapacitySummary({ classId: "8" });

  assert.equal(summary.capacity, null);
  assert.equal(summary.capacityConfigured, false);
  assert.equal(summary.availableCapacity, null);
  assert.equal(summary.full, false);
});

test("ClassApplicationService exposes an official capacity gate for available classes", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findById({ classId }) {
        return {
          classId,
          name: "Sub-13",
          status: "ativa",
        };
      },
      async getClassCapacitySnapshot({ classId }) {
        return {
          capacity: 3,
          classId,
          classRecord: {
            classId,
            name: "Sub-13",
            status: "ativa",
          },
          currentStudentCount: 2,
        };
      },
    },
  });

  const result = await service.ensureClassHasAvailableCapacity({ classId: "7" });

  assert.equal(result.classId, 7);
  assert.equal(result.capacityTotal, 3);
  assert.equal(result.occupiedSlots, 2);
  assert.equal(result.availableSlots, 1);
  assert.equal(result.hasAvailableCapacity, true);
  assert.equal(result.capacitySource, "j12_turmas.capacidade + active j12_alunos links");
});

test("ClassApplicationService blocks full classes with a controlled error", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findById({ classId }) {
        return {
          classId,
          name: "Sub-13",
          status: "ativa",
        };
      },
      async getClassCapacitySnapshot({ classId }) {
        return {
          capacity: 3,
          classId,
          classRecord: {
            classId,
            name: "Sub-13",
            status: "ativa",
          },
          currentStudentCount: 3,
        };
      },
    },
  });

  await assert.rejects(
    () => service.ensureClassHasAvailableCapacity({ classId: "9" }),
    (error) => {
      assert.equal(error.code, "CLASS_CAPACITY_FULL");
      assert.equal(error.details?.classId, 9);
      return true;
    },
  );
});

test("ClassApplicationService accepts full occupancy when it does not exceed capacity", async () => {
  const calls = [];
  const service = new ClassApplicationService({
    classRepository: {
      async findById() {
        throw new Error("findById should not be called when snapshot has classRecord.");
      },
      async getClassCapacitySnapshot(input) {
        calls.push(input);
        return {
          capacity: 3,
          capacitySource: "j12_turmas.capacidade + active enrollment_class_links",
          classId: input.classId,
          classRecord: {
            classId: input.classId,
            name: "Sub-13",
            status: "ativa",
          },
          currentStudentCount: 3,
          studentCountSource: "enrollment_class_links ACTIVE links",
        };
      },
    },
  });

  const result = await service.ensureClassOccupancyWithinCapacity({
    classId: "9",
    lockForUpdate: true,
    occupancySource: "enrollment_class_links",
  });

  assert.equal(result.classId, 9);
  assert.equal(result.capacityTotal, 3);
  assert.equal(result.occupiedSlots, 3);
  assert.equal(result.hasAvailableCapacity, false);
  assert.equal(result.occupancyConsistent, true);
  assert.equal(result.capacitySource, "j12_turmas.capacidade + active enrollment_class_links");
  assert.deepEqual(calls, [
    {
      classId: 9,
      lockForUpdate: true,
      occupancySource: "enrollment_class_links",
    },
  ]);
});

test("ClassApplicationService blocks occupancy above capacity", async () => {
  const service = new ClassApplicationService({
    classRepository: {
      async findById() {
        throw new Error("findById should not be called when snapshot has classRecord.");
      },
      async getClassCapacitySnapshot({ classId }) {
        return {
          capacity: 3,
          classId,
          classRecord: {
            classId,
            name: "Sub-13",
            status: "ativa",
          },
          currentStudentCount: 4,
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.ensureClassOccupancyWithinCapacity({
        classId: "9",
        occupancySource: "enrollment_class_links",
      }),
    (error) => {
      assert.equal(error.code, "CLASS_CAPACITY_OVERBOOKED");
      assert.equal(error.details?.capacityTotal, 3);
      assert.equal(error.details?.occupiedSlots, 4);
      return true;
    },
  );
});
