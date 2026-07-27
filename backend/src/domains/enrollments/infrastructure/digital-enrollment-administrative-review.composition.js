const {
  DigitalEnrollmentAdministrativeReviewService,
} = require("../application/services/digital-enrollment-administrative-review.service.js");
const {
  DigitalEnrollmentAdministrativeWorkflowService,
} = require("../application/services/digital-enrollment-administrative-workflow.service.js");
const {
  MySqlDigitalEnrollmentAdministrativeReviewRepository,
} = require("./repositories/mysql-digital-enrollment-administrative-review.repository.js");

/**
 * Composes the Digital Enrollment administrative review services.
 *
 * The query and transaction runners are mandatory to prevent the repository
 * from using its config/db.js fallbacks during composition.
 *
 * This composition does not mount controllers, routes or migrations.
 *
 * @param {Object} [options]
 * @param {{ authorize: Function }} options.authorizationPolicy
 * @param {Function} [options.clock]
 * @param {{ getAcceptanceStatus: Function }} options.contractAcceptanceReader
 * @param {{ execute: Function }} options.documentCompletionService
 * @param {{ evaluate: Function }} options.eligibilityPolicy
 * @param {{ findById?: Function, findEnrollmentById?: Function }} options.enrollmentReader
 * @param {Function} [options.idGenerator]
 * @param {Object} [options.logger]
 * @param {{ findByEnrollmentId: Function }} options.progressReader
 * @param {Function} options.queryRunner
 * @param {string[]} options.requiredDocumentTypes
 * @param {Function} options.transactionRunner
 * @returns {{
 *   repository: MySqlDigitalEnrollmentAdministrativeReviewRepository,
 *   reviewService: DigitalEnrollmentAdministrativeReviewService,
 *   workflowService: DigitalEnrollmentAdministrativeWorkflowService,
 * }}
 */
function createDigitalEnrollmentAdministrativeReviewComposition({
  authorizationPolicy,
  clock,
  contractAcceptanceReader,
  documentCompletionService,
  eligibilityPolicy,
  enrollmentReader,
  idGenerator,
  logger,
  progressReader,
  queryRunner,
  requiredDocumentTypes,
  transactionRunner,
} = {}) {
  validateDependencies({
    authorizationPolicy,
    contractAcceptanceReader,
    documentCompletionService,
    eligibilityPolicy,
    enrollmentReader,
    progressReader,
    queryRunner,
    requiredDocumentTypes,
    transactionRunner,
  });

  const repository = new MySqlDigitalEnrollmentAdministrativeReviewRepository({
    idGenerator,
    queryRunner,
    transactionRunner,
  });

  const reviewService = new DigitalEnrollmentAdministrativeReviewService({
    authorizationPolicy,
    clock,
    eligibilityPolicy,
    idGenerator,
    logger,
    repository,
  });

  const workflowService = new DigitalEnrollmentAdministrativeWorkflowService({
    administrativeReviewService: reviewService,
    authorizationPolicy,
    contractAcceptanceReader,
    documentCompletionService,
    enrollmentReader,
    eligibilityPolicy,
    progressReader,
    requiredDocumentTypes,
  });

  return Object.freeze({
    repository,
    reviewService,
    workflowService,
  });
}

function validateDependencies({
  authorizationPolicy,
  contractAcceptanceReader,
  documentCompletionService,
  eligibilityPolicy,
  enrollmentReader,
  progressReader,
  queryRunner,
  requiredDocumentTypes,
  transactionRunner,
}) {
  requireMethod(authorizationPolicy, "authorize", "authorizationPolicy");

  requireMethod(contractAcceptanceReader, "getAcceptanceStatus", "contractAcceptanceReader");

  requireMethod(documentCompletionService, "execute", "documentCompletionService");

  requireMethod(eligibilityPolicy, "evaluate", "eligibilityPolicy");

  if (
    !enrollmentReader ||
    (typeof enrollmentReader.findById !== "function" &&
      typeof enrollmentReader.findEnrollmentById !== "function")
  ) {
    throw new TypeError(
      "Digital enrollment administrative review composition requires enrollmentReader.findById() or enrollmentReader.findEnrollmentById().",
    );
  }

  requireMethod(progressReader, "findByEnrollmentId", "progressReader");

  requireFunction(queryRunner, "queryRunner");
  requireFunction(transactionRunner, "transactionRunner");

  if (!Array.isArray(requiredDocumentTypes)) {
    throw new TypeError(
      "Digital enrollment administrative review composition requires requiredDocumentTypes to be an array.",
    );
  }
}

function requireMethod(value, method, dependency) {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(
      `Digital enrollment administrative review composition requires ${dependency}.${method}().`,
    );
  }
}

function requireFunction(value, dependency) {
  if (typeof value !== "function") {
    throw new TypeError(
      `Digital enrollment administrative review composition requires ${dependency} to be a function.`,
    );
  }
}

module.exports = {
  createDigitalEnrollmentAdministrativeReviewComposition,
};
