const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
} = require("../contracts/index.js");
const {
  ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
  ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
  EnrollmentClassLinkService,
} = require("../services/enrollment-class-link.service.js");

test("EnrollmentClassLinkService prepares blocked Enrollment -> Turma integration for ACTIVE Enrollment", async () => {
  const service = new EnrollmentClassLinkService({
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-class",
          studentProfileId: "profile-class",
        };
      },
    },
  });

  const result = await service.prepareActiveEnrollmentClassLink({
    classId: 10,
    enrollmentId: "active-class",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.personToClassFlowPrepared, true);
  assert.equal(result.classModuleMapped, true);
  assert.equal(result.classIntegrationBlocked, true);
  assert.equal(result.linkCreated, false);
  assert.equal(result.persisted, false);
  assert.equal(result.eventDispatched, false);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noScheduleSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(result.classValidation.classReaderAvailable, false);
  assert.equal(result.enrollmentSnapshot.status, "ACTIVE");
});

test("EnrollmentClassLinkService blocks DRAFT Enrollment before Turma preparation", async () => {
  const service = new EnrollmentClassLinkService({
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "DRAFT",
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.prepareActiveEnrollmentClassLink({
        classId: 10,
        enrollmentId: "draft-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
    },
  );
});

test("EnrollmentClassLinkService handles invalid Turma identifiers", async () => {
  const service = new EnrollmentClassLinkService({
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.prepareActiveEnrollmentClassLink({
        classId: "turma-x",
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
    },
  );
});

test("EnrollmentClassLinkService validates Turma when a safe class reader is injected", async () => {
  const service = new EnrollmentClassLinkService({
    classReader: {
      async findClassById(id) {
        return {
          alunoIds: ["1"],
          capacidadeMaxima: 3,
          id,
          nome: "Sub-13",
          status: "ativa",
        };
      },
      async findExistingEnrollmentClassLink() {
        return null;
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  const result = await service.prepareActiveEnrollmentClassLink({
    classId: 11,
    enrollmentId: "active-class",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.classValidation.classReaderAvailable, true);
  assert.equal(result.classValidation.classFound, true);
  assert.equal(result.classValidation.classStatus, "ativa");
  assert.equal(result.classValidation.capacityChecked, true);
  assert.equal(result.classValidation.capacityAvailable, true);
  assert.equal(result.classValidation.duplicateCheckAvailable, true);
  assert.equal(result.classValidation.duplicateLinkFound, false);
  assert.equal(result.classValidation.name, "Sub-13");
});

test("EnrollmentClassLinkService validates Turma through ClassFacade", async () => {
  const calls = [];
  const service = new EnrollmentClassLinkService({
    classFacade: {
      async findActiveClassById(input) {
        calls.push(["findActiveClassById", input]);
        return {
          id: input.classId,
          name: "Sub-15",
          status: "ativa",
        };
      },
      async ensureClassHasAvailableCapacity(input) {
        calls.push(["ensureClassHasAvailableCapacity", input]);
        return {
          availableSlots: 2,
          capacitySource: "ClassFacade",
          capacityTotal: 3,
          classId: Number(input.classId),
          className: "Sub-15",
          hasAvailableCapacity: true,
          occupiedSlots: 1,
        };
      },
    },
    classLinkRepository: {
      async findActiveByEnrollmentAndClass(input) {
        calls.push(["findActiveByEnrollmentAndClass", input]);
        return null;
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  const result = await service.prepareActiveEnrollmentClassLink({
    classId: 16,
    enrollmentId: "active-class-facade",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.classValidation.classFacadeAvailable, true);
  assert.equal(result.classValidation.classReaderAvailable, false);
  assert.equal(result.classValidation.classValidatedByFacade, true);
  assert.equal(result.classValidation.capacityChecked, true);
  assert.equal(result.classValidation.capacityAvailable, true);
  assert.equal(result.classValidation.capacity, 3);
  assert.equal(result.classValidation.currentStudents, 1);
  assert.equal(result.classValidation.duplicateCheckAvailable, true);
  assert.deepEqual(calls, [
    ["findActiveClassById", { classId: "16" }],
    ["ensureClassHasAvailableCapacity", { classId: "16" }],
    ["findActiveByEnrollmentAndClass", { classId: "16", enrollmentId: "active-class-facade" }],
  ]);
});

test("EnrollmentClassLinkService maps ClassFacade inactive and missing Turma states", async () => {
  await assert.rejects(
    () =>
      createServiceWithClassFacade({
        activeClass: null,
        classRecord: {
          id: 17,
          status: "inativa",
        },
      }).prepareActiveEnrollmentClassLink({
        classId: 17,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
    },
  );

  await assert.rejects(
    () =>
      createServiceWithClassFacade({
        activeClass: null,
        classRecord: null,
      }).prepareActiveEnrollmentClassLink({
        classId: 18,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
    },
  );
});

test("EnrollmentClassLinkService maps ClassFacade capacity errors", async () => {
  await assert.rejects(
    () =>
      createServiceWithClassFacade({
        capacityErrorCode: "CLASS_CAPACITY_FULL",
      }).prepareActiveEnrollmentClassLink({
        classId: 19,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
    },
  );

  await assert.rejects(
    () =>
      createServiceWithClassFacade({
        capacityErrorCode: "CLASS_CAPACITY_UNCONFIGURED",
      }).prepareActiveEnrollmentClassLink({
        classId: 20,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED_CODE,
    },
  );
});

test("EnrollmentClassLinkService blocks duplicated links after ClassFacade validation", async () => {
  const service = createServiceWithClassFacade({
    duplicateLink: {
      classId: 21,
      enrollmentId: "active-class",
      id: "existing-link",
      status: "ACTIVE",
    },
  });

  await assert.rejects(
    () =>
      service.prepareActiveEnrollmentClassLink({
        classId: 21,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
    },
  );
});

test("EnrollmentClassLinkService creates a real ACTIVE link for ACTIVE Enrollment", async () => {
  const links = [];
  const service = new EnrollmentClassLinkService({
    classLinkRepository: {
      async createOrReuseActiveLink(input) {
        links.push(input);
        return {
          id: "link-1",
          enrollment_id: input.enrollmentId,
          class_id: input.classId,
          linked_by: input.linkedBy,
          status: "ACTIVE",
        };
      },
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          alunoIds: [],
          capacidadeMaxima: 3,
          id,
          nome: "Sub-13",
          status: "ativa",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  const result = await service.linkActiveEnrollmentToClass({
    classId: 21,
    enrollmentId: "active-link",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, true);
  assert.equal(result.link.status, "ACTIVE");
  assert.equal(result.link.enrollment_id, "active-link");
  assert.equal(result.link.class_id, 21);
  assert.deepEqual(links, [{ classId: 21, enrollmentId: "active-link", linkedBy: "admin@j12.local" }]);
});

test("EnrollmentClassLinkService reuses repository metadata from createActiveLinkIfNotExists", async () => {
  const service = new EnrollmentClassLinkService({
    classLinkRepository: {
      async createActiveLinkIfNotExists(input) {
        return {
          created: false,
          link: {
            classId: input.classId,
            enrollmentId: input.enrollmentId,
            id: "existing-link",
            linkedBy: input.linkedBy,
            status: "ACTIVE",
          },
          reused: true,
        };
      },
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          alunoIds: [],
          capacidadeMaxima: 3,
          id,
          nome: "Sub-13",
          status: "ativa",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  const result = await service.linkActiveEnrollmentToClass({
    classId: 21,
    enrollmentId: "active-link",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.link.id, "existing-link");
});

test("EnrollmentClassLinkService blocks real link when Turmas reader is unavailable", async () => {
  const service = new EnrollmentClassLinkService({
    classLinkRepository: {
      async createActiveLinkIfNotExists() {
        throw new Error("should not create without class reader");
      },
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.linkActiveEnrollmentToClass({
        classId: 21,
        enrollmentId: "active-link",
        linkedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
    },
  );
});

test("EnrollmentClassLinkService blocks a link when the class is at full capacity", async () => {
  const service = new EnrollmentClassLinkService({
    classLinkRepository: {
      async createOrReuseActiveLink() {
        throw new Error("should not create when full");
      },
      async getClassCapacitySnapshot() {
        return {
          activeLinkCount: 2,
          capacity: 2,
          classId: 23,
        };
      },
      async findActiveByEnrollmentAndClass() {
        return null;
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          alunoIds: [],
          capacidadeMaxima: 2,
          id,
          nome: "Sub-13",
          status: "ativa",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.linkActiveEnrollmentToClass({
        classId: 23,
        enrollmentId: "active-link",
        linkedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
    },
  );
});

test("EnrollmentClassLinkService can run link creation inside an injected transaction context", async () => {
  const events = [];
  const service = new EnrollmentClassLinkService({
    async transactionRunner(work) {
      events.push("begin");
      const result = await work({
        classLinkRepository: {
          async createActiveLinkIfNotExists(input) {
            events.push(`insert:${input.enrollmentId}:${input.classId}`);
            return {
              created: true,
              link: {
                classId: input.classId,
                enrollmentId: input.enrollmentId,
                id: "tx-link",
                linkedAt: "2026-07-01T10:00:00.000Z",
                linkedBy: input.linkedBy,
                status: "ACTIVE",
              },
              reused: false,
            };
          },
          async findActiveByEnrollmentAndClass() {
            return null;
          },
          async getClassCapacitySnapshot() {
            return {
              activeLinkCount: 0,
              availableCapacity: null,
              capacity: null,
              classId: 24,
            };
          },
        },
        classReader: {
          async findClassById(id) {
            return {
              capacidadeMaxima: 2,
              id,
              nome: "Sub-15",
              status: "ativa",
            };
          },
        },
        enrollmentReader: {
          async findEnrollmentById(id) {
            return {
              id,
              status: "ACTIVE",
            };
          },
        },
      });
      events.push("commit");
      return result;
    },
  });

  const result = await service.linkActiveEnrollmentToClass({
    classId: 24,
    enrollmentId: "active-link",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, true);
  assert.equal(result.transactional, true);
  assert.equal(result.linkAuditPersisted, true);
  assert.equal(result.link.id, "tx-link");
  assert.deepEqual(events, ["begin", "insert:active-link:24", "commit"]);
});

test("EnrollmentClassLinkService reuses an existing ACTIVE link for duplicate requests", async () => {
  const service = new EnrollmentClassLinkService({
    classLinkRepository: {
      async createOrReuseActiveLink() {
        return {
          id: "existing-link",
          enrollment_id: "active-link",
          class_id: 22,
          linked_by: "admin@j12.local",
          status: "ACTIVE",
        };
      },
      async findActiveByEnrollmentAndClass() {
        return {
          id: "existing-link",
          enrollment_id: "active-link",
          class_id: 22,
          linked_by: "admin@j12.local",
          status: "ACTIVE",
        };
      },
    },
    classReader: {
      async findClassById(id) {
        return {
          alunoIds: [],
          capacidadeMaxima: 3,
          id,
          nome: "Sub-13",
          status: "ativa",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });

  const result = await service.linkActiveEnrollmentToClass({
    classId: 22,
    enrollmentId: "active-link",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.link.id, "existing-link");
});

test("EnrollmentClassLinkService blocks missing, inactive, full and duplicated Turma states when validated", async () => {
  await assert.rejects(
    () =>
      createServiceWithClass(null).prepareActiveEnrollmentClassLink({
        classId: 12,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
    },
  );

  await assert.rejects(
    () =>
      createServiceWithClass({ id: 13, status: "inativa" }).prepareActiveEnrollmentClassLink({
        classId: 13,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
    },
  );

  await assert.rejects(
    () =>
      createServiceWithClass({
        alunoIds: ["1", "2"],
        capacidadeMaxima: 2,
        id: 14,
        status: "ativa",
      }).prepareActiveEnrollmentClassLink({
        classId: 14,
        enrollmentId: "active-class",
        requestedBy: "admin@j12.local",
      }),
    {
      code: ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
    },
  );

  await assert.rejects(
    () =>
      createServiceWithClass({ id: 15, status: "ativa" }, { id: "link-1" })
        .prepareActiveEnrollmentClassLink({
          classId: 15,
          enrollmentId: "active-class",
          requestedBy: "admin@j12.local",
        }),
    {
      code: ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
    },
  );
});

function createServiceWithClass(turma, duplicateLink = null) {
  return new EnrollmentClassLinkService({
    classReader: {
      async findClassById() {
        return turma;
      },
      async findExistingEnrollmentClassLink() {
        return duplicateLink;
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });
}

function createServiceWithClassFacade({
  activeClass = {
    id: 20,
    name: "Sub-15",
    status: "ativa",
  },
  capacityErrorCode = null,
  capacitySummary = {
    availableSlots: 1,
    capacityTotal: 2,
    classId: 20,
    hasAvailableCapacity: true,
    occupiedSlots: 1,
  },
  classRecord = activeClass,
  duplicateLink = null,
} = {}) {
  return new EnrollmentClassLinkService({
    classFacade: {
      async findActiveClassById() {
        return activeClass;
      },
      async findClassById() {
        return classRecord;
      },
      async ensureClassHasAvailableCapacity() {
        if (capacityErrorCode) {
          const error = new Error(capacityErrorCode);
          error.code = capacityErrorCode;
          error.details = {
            capacityTotal: 2,
            classId: 20,
            occupiedSlots: 2,
          };
          throw error;
        }

        return capacitySummary;
      },
    },
    classLinkRepository: {
      async findActiveByEnrollmentAndClass() {
        return duplicateLink;
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-active",
          studentProfileId: "profile-active",
        };
      },
    },
  });
}
