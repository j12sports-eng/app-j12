const { ClassFacade } = require("../../classes/application/facades/class.facade.js");
const {
  MySqlClassRepository,
} = require("../../classes/infrastructure/repositories/mysql-class.repository.js");
const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const {
  EnrollmentClassLinkService,
} = require("../application/services/enrollment-class-link.service.js");
const {
  createMySqlEnrollmentClassLinkTransactionRunner,
} = require("./repositories/mysql-enrollment-class-link.transaction-runner.js");

/**
 * Builds the official Classes facade over the transaction-scoped query runner.
 * This ensures class locking, capacity reads, Enrollment reads and link writes
 * share one connection and one commit/rollback boundary.
 *
 * @param {{ queryRunner: Function }} input
 * @returns {ClassFacade}
 */
function createTransactionalClassFacade({ queryRunner } = {}) {
  if (typeof queryRunner !== "function") {
    throw new TypeError("Transactional ClassFacade requires a queryRunner function.");
  }

  return new ClassFacade({
    classRepository: new MySqlClassRepository({ queryRunner }),
  });
}

/**
 * Composes the canonical Enrollment -> Turma application operation using the
 * existing repository and transaction runner. It does not mount an HTTP route.
 *
 * @param {Object} [options]
 * @returns {EnrollmentClassLinkService}
 */
function createCanonicalEnrollmentClassLinkService(options = {}) {
  const logger = options.logger || console;
  const transactionRunner =
    options.transactionRunner ||
    createMySqlEnrollmentClassLinkTransactionRunner({
      classFacadeFactory: options.classFacadeFactory || createTransactionalClassFacade,
      classLinkRepositoryFactory: options.classLinkRepositoryFactory,
      enrollmentRepositoryFactory: options.enrollmentRepositoryFactory,
      lockTimeoutSeconds: options.lockTimeoutSeconds,
      logger,
      transaction: options.transaction,
    });

  return new EnrollmentClassLinkService({
    authorizeClassAssignment: options.authorizeClassAssignment,
    clock: options.clock,
    logger,
    transactionRunner,
  });
}

/**
 * Exposes the canonical operation through the existing Enrollment facade.
 *
 * @param {Object} [options]
 * @returns {EnrollmentFacade}
 */
function createCanonicalEnrollmentClassLinkFacade(options = {}) {
  const enrollmentClassLinkService =
    options.enrollmentClassLinkService || createCanonicalEnrollmentClassLinkService(options);

  return new EnrollmentFacade({
    enrollmentApplicationService: options.enrollmentApplicationService,
    enrollmentClassLinkService,
    enrollmentFactory: options.enrollmentFactory,
    enrollmentRepository: options.enrollmentRepository,
    eventDispatcher: options.eventDispatcher,
    eventLogger: options.logger,
  });
}

module.exports = {
  createCanonicalEnrollmentClassLinkFacade,
  createCanonicalEnrollmentClassLinkService,
  createTransactionalClassFacade,
};
