const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentAdministrativeReviewService,
} = require("../application/services/digital-enrollment-administrative-review.service.js");
const {
  DigitalEnrollmentAdministrativeWorkflowService,
} = require("../application/services/digital-enrollment-administrative-workflow.service.js");
const {
  createDigitalEnrollmentAdministrativeReviewComposition,
} = require("./digital-enrollment-administrative-review.composition.js");
const {
  MemoryDigitalEnrollmentAdministrativeReviewRepository,
} = require("./repositories/memory-digital-enrollment-administrative-review.repository.js");
const {
  MySqlDigitalEnrollmentAdministrativeReviewRepository,
} = require("./repositories/mysql-digital-enrollment-administrative-review.repository.js");

test("creates the MySQL administrative review repository", () => {
  const options = validOptions();
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(
    composition.repository instanceof MySqlDigitalEnrollmentAdministrativeReviewRepository,
    true,
  );

  assert.equal(composition.repository.idGenerator, options.idGenerator);

  assert.equal(composition.repository.query, options.queryRunner);

  assert.equal(composition.repository.transactionRunner, options.transactionRunner);
});

test("creates the administrative review service", () => {
  const options = validOptions();
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(
    composition.reviewService instanceof DigitalEnrollmentAdministrativeReviewService,
    true,
  );

  assert.equal(composition.reviewService.authorizationPolicy, options.authorizationPolicy);

  assert.equal(composition.reviewService.clock, options.clock);

  assert.equal(composition.reviewService.eligibilityPolicy, options.eligibilityPolicy);

  assert.equal(composition.reviewService.idGenerator, options.idGenerator);

  assert.equal(composition.reviewService.logger, options.logger);
});

test("creates the administrative workflow service", () => {
  const options = validOptions();
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(
    composition.workflowService instanceof DigitalEnrollmentAdministrativeWorkflowService,
    true,
  );

  assert.equal(composition.workflowService.authorizationPolicy, options.authorizationPolicy);

  assert.equal(
    composition.workflowService.contractAcceptanceReader,
    options.contractAcceptanceReader,
  );

  assert.equal(
    composition.workflowService.documentCompletionService,
    options.documentCompletionService,
  );

  assert.equal(composition.workflowService.enrollmentReader, options.enrollmentReader);

  assert.equal(composition.workflowService.eligibilityPolicy, options.eligibilityPolicy);

  assert.equal(composition.workflowService.progressReader, options.progressReader);
});

test("returns a frozen composition object", () => {
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.equal(Object.isFrozen(composition), true);
});

test("creates and reuses exactly one repository instance", () => {
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.equal(composition.reviewService.repository, composition.repository);
});

test("injects the same review service into the workflow", () => {
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.equal(composition.workflowService.administrativeReviewService, composition.reviewService);
});

test("delivers requiredDocumentTypes to the workflow", () => {
  const options = validOptions();
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.deepEqual(
    composition.workflowService.requiredDocumentTypes,
    options.requiredDocumentTypes,
  );

  assert.notEqual(composition.workflowService.requiredDocumentTypes, options.requiredDocumentTypes);

  assert.equal(Object.isFrozen(composition.workflowService.requiredDocumentTypes), true);
});

test("does not mutate the supplied options", () => {
  const options = validOptions();
  const originalDocumentTypes = options.requiredDocumentTypes;
  const snapshot = { ...options };

  createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.deepEqual(options, snapshot);
  assert.equal(options.requiredDocumentTypes, originalDocumentTypes);
  assert.equal(Object.isFrozen(options), false);
  assert.equal(Object.isFrozen(options.requiredDocumentTypes), false);
});

test("preserves service defaults when optional dependencies are absent", () => {
  const options = validOptions();

  delete options.clock;
  delete options.idGenerator;
  delete options.logger;

  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(typeof composition.reviewService.clock, "function");

  assert.equal(typeof composition.reviewService.idGenerator, "function");

  assert.equal(composition.reviewService.logger, null);
  assert.equal(typeof composition.repository.idGenerator, "function");
});

test("fails closed without authorizationPolicy", () => {
  assertMissingDependency("authorizationPolicy", /authorizationPolicy\.authorize/);
});

test("fails closed when authorizationPolicy has no authorize method", () => {
  assertInvalidDependency("authorizationPolicy", {}, /authorizationPolicy\.authorize/);
});

test("fails closed without contractAcceptanceReader", () => {
  assertMissingDependency(
    "contractAcceptanceReader",
    /contractAcceptanceReader\.getAcceptanceStatus/,
  );
});

test("fails closed when contractAcceptanceReader has no getAcceptanceStatus method", () => {
  assertInvalidDependency(
    "contractAcceptanceReader",
    {},
    /contractAcceptanceReader\.getAcceptanceStatus/,
  );
});

test("fails closed without documentCompletionService", () => {
  assertMissingDependency("documentCompletionService", /documentCompletionService\.execute/);
});

test("fails closed when documentCompletionService has no execute method", () => {
  assertInvalidDependency("documentCompletionService", {}, /documentCompletionService\.execute/);
});

test("fails closed without eligibilityPolicy", () => {
  assertMissingDependency("eligibilityPolicy", /eligibilityPolicy\.evaluate/);
});

test("fails closed when eligibilityPolicy has no evaluate method", () => {
  assertInvalidDependency("eligibilityPolicy", {}, /eligibilityPolicy\.evaluate/);
});

test("fails closed without enrollmentReader", () => {
  assertMissingDependency("enrollmentReader", /enrollmentReader\.findById.*findEnrollmentById/);
});

test("fails closed when enrollmentReader has no accepted method", () => {
  assertInvalidDependency("enrollmentReader", {}, /enrollmentReader\.findById.*findEnrollmentById/);
});

test("accepts enrollmentReader.findEnrollmentById", () => {
  const options = validOptions();

  options.enrollmentReader = {
    async findEnrollmentById() {},
  };

  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(composition.workflowService.enrollmentReader, options.enrollmentReader);
});

test("fails closed without progressReader", () => {
  assertMissingDependency("progressReader", /progressReader\.findByEnrollmentId/);
});

test("fails closed when progressReader has no findByEnrollmentId method", () => {
  assertInvalidDependency("progressReader", {}, /progressReader\.findByEnrollmentId/);
});

test("fails closed without queryRunner", () => {
  assertMissingDependency("queryRunner", /queryRunner.*function/);
});

test("fails closed when queryRunner is not a function", () => {
  assertInvalidDependency("queryRunner", {}, /queryRunner.*function/);
});

test("fails closed without transactionRunner", () => {
  assertMissingDependency("transactionRunner", /transactionRunner.*function/);
});

test("fails closed when transactionRunner is not a function", () => {
  assertInvalidDependency("transactionRunner", {}, /transactionRunner.*function/);
});

test("fails closed when requiredDocumentTypes is absent", () => {
  assertMissingDependency("requiredDocumentTypes", /requiredDocumentTypes.*array/);
});

test("fails closed when requiredDocumentTypes is not an array", () => {
  assertInvalidDependency("requiredDocumentTypes", "CPF", /requiredDocumentTypes.*array/);
});

test("accepts an explicitly empty requiredDocumentTypes array", () => {
  const options = validOptions();

  options.requiredDocumentTypes = [];

  const composition = createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.deepEqual(composition.workflowService.requiredDocumentTypes, []);
});

test("does not instantiate the memory repository", () => {
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.equal(
    composition.repository instanceof MemoryDigitalEnrollmentAdministrativeReviewRepository,
    false,
  );

  assert.equal(
    composition.repository instanceof MySqlDigitalEnrollmentAdministrativeReviewRepository,
    true,
  );
});

test("does not load config/db.js while composing", () => {
  const dbModulePath = require.resolve("../../../config/db.js");

  assert.equal(require.cache[dbModulePath], undefined);

  createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.equal(require.cache[dbModulePath], undefined);
});

test("does not call queryRunner or transactionRunner while composing", () => {
  const options = validOptions();
  let queryCalls = 0;
  let transactionCalls = 0;

  options.queryRunner = async () => {
    queryCalls += 1;
    return [];
  };

  options.transactionRunner = async () => {
    transactionCalls += 1;
  };

  createDigitalEnrollmentAdministrativeReviewComposition(options);

  assert.equal(queryCalls, 0);
  assert.equal(transactionCalls, 0);
});

test("returns no controller, router or migration collaborator", () => {
  const composition = createDigitalEnrollmentAdministrativeReviewComposition(validOptions());

  assert.deepEqual(Object.keys(composition).sort(), [
    "repository",
    "reviewService",
    "workflowService",
  ]);

  assert.equal("controller" in composition, false);
  assert.equal("router" in composition, false);
  assert.equal("migration" in composition, false);
});

function validOptions() {
  return {
    authorizationPolicy: {
      async authorize() {
        return true;
      },
    },
    clock: () => "2026-07-27T15:00:00.000Z",
    contractAcceptanceReader: {
      async getAcceptanceStatus() {
        return { accepted: true };
      },
    },
    documentCompletionService: {
      async execute() {
        return { complete: true };
      },
    },
    eligibilityPolicy: {
      evaluate() {
        return { eligible: true };
      },
    },
    enrollmentReader: {
      async findById() {
        return null;
      },
    },
    idGenerator: () => "review-id",
    logger: {
      info() {},
    },
    progressReader: {
      async findByEnrollmentId() {
        return null;
      },
    },
    queryRunner: async () => [],
    requiredDocumentTypes: ["CPF", "RG"],
    transactionRunner: async (work) => work(async () => []),
  };
}

function assertMissingDependency(property, message) {
  const options = validOptions();

  delete options[property];

  assert.throws(() => createDigitalEnrollmentAdministrativeReviewComposition(options), {
    message,
    name: "TypeError",
  });
}

function assertInvalidDependency(property, value, message) {
  const options = validOptions();

  options[property] = value;

  assert.throws(() => createDigitalEnrollmentAdministrativeReviewComposition(options), {
    message,
    name: "TypeError",
  });
}
