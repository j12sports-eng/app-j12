const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const {
  EnrollmentClassLinkService,
} = require("../application/services/enrollment-class-link.service.js");
const {
  createCanonicalEnrollmentClassLinkFacade,
  createCanonicalEnrollmentClassLinkService,
  createTransactionalClassFacade,
} = require("./enrollment-class-link.composition.js");

test("createTransactionalClassFacade uses the transaction-scoped query runner", async () => {
  const calls = [];
  const facade = createTransactionalClassFacade({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [
        {
          capacidade: 20,
          id: 12,
          nome: "Sub-17",
          status: "ativa",
        },
      ];
    },
  });

  const result = await facade.findActiveClassById({ classId: 12 });

  assert.equal(result.classId, 12);
  assert.equal(result.active, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM j12_turmas turma/);
  assert.deepEqual(calls[0].params, [12]);
});

test("canonical service composition reuses the existing service and injected transaction runner", () => {
  const transactionRunner = async (work) => work({});
  const service = createCanonicalEnrollmentClassLinkService({
    authorizeClassAssignment: async () => true,
    transactionRunner,
  });

  assert.equal(service instanceof EnrollmentClassLinkService, true);
  assert.equal(service.transactionRunner, transactionRunner);
  assert.equal(service.logger, console);
  assert.equal(typeof service.assignEnrollmentToClass, "function");
});

test("canonical facade composition reuses EnrollmentFacade without mounting HTTP", async () => {
  const calls = [];
  const enrollmentClassLinkService = {
    async assignEnrollmentToClass(command, context) {
      calls.push({ command, context });
      return Object.freeze({
        classId: command.classId,
        created: true,
        enrollmentClassLinkId: "composed-link",
        enrollmentId: command.enrollmentId,
        status: "ACTIVE",
      });
    },
  };
  const facade = createCanonicalEnrollmentClassLinkFacade({
    enrollmentClassLinkService,
  });

  const result = await facade.assignEnrollmentToClass(
    { classId: 8, enrollmentId: "composed-enrollment" },
    { actorId: "composed-actor" },
  );

  assert.equal(facade instanceof EnrollmentFacade, true);
  assert.equal(result.enrollmentClassLinkId, "composed-link");
  assert.equal(calls.length, 1);
});
