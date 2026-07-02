const {
  MySqlEnrollmentClassLinkRepository,
} = require("./mysql-enrollment-class-link.repository.js");
const {
  MySqlEnrollmentRepository,
} = require("./mysql-enrollment.repository.js");

/**
 * Creates the MySQL transaction boundary for real Enrollment -> Turma link
 * persistence. Class validation remains injected through classFacadeFactory so
 * this infrastructure helper does not import Turmas repositories directly.
 *
 * @param {Object} [options]
 * @param {(work: (connection: { execute: Function }) => Promise<unknown>) => Promise<unknown>} [options.transaction]
 * @param {(input: { connection: unknown, queryRunner: Function }) => unknown} [options.classFacadeFactory]
 * @param {(input: { connection: unknown, queryRunner: Function }) => unknown} [options.classLinkRepositoryFactory]
 * @param {(input: { connection: unknown, queryRunner: Function }) => unknown} [options.enrollmentRepositoryFactory]
 * @param {unknown} [options.logger]
 * @param {number} [options.lockTimeoutSeconds]
 * @returns {(work: (context: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>}
 */
function createMySqlEnrollmentClassLinkTransactionRunner(options = {}) {
  const transaction = options.transaction || getDefaultTransaction();
  const classFacadeFactory =
    typeof options.classFacadeFactory === "function" ? options.classFacadeFactory : null;
  const classLinkRepositoryFactory =
    typeof options.classLinkRepositoryFactory === "function"
      ? options.classLinkRepositoryFactory
      : ({ queryRunner }) => new MySqlEnrollmentClassLinkRepository({ queryRunner });
  const enrollmentRepositoryFactory =
    typeof options.enrollmentRepositoryFactory === "function"
      ? options.enrollmentRepositoryFactory
      : ({ queryRunner }) =>
          new MySqlEnrollmentRepository({
            logger: options.logger || console,
            lockTimeoutSeconds: options.lockTimeoutSeconds,
            queryRunner,
          });

  if (typeof transaction !== "function") {
    throw new TypeError(
      "createMySqlEnrollmentClassLinkTransactionRunner requires a transaction function.",
    );
  }

  return async function runEnrollmentClassLinkTransaction(work) {
    if (typeof work !== "function") {
      throw new TypeError("Enrollment class link transaction work must be a function.");
    }

    return transaction(async (connection) => {
      const queryRunner = createConnectionQueryRunner(connection);
      const context = {
        classCapacityTransactionEnabled: Boolean(classFacadeFactory),
        classLinkRepository: classLinkRepositoryFactory({ connection, queryRunner }),
        enrollmentReader: enrollmentRepositoryFactory({ connection, queryRunner }),
        transactionConnection: connection,
        transactionQueryRunner: queryRunner,
      };

      if (classFacadeFactory) {
        context.classFacade = classFacadeFactory({ connection, queryRunner });
      }

      return work(context);
    });
  };
}

/**
 * @param {{ execute?: (sql: string, params?: unknown[]) => Promise<unknown[]> }} connection
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function createConnectionQueryRunner(connection) {
  if (!connection || typeof connection.execute !== "function") {
    throw new TypeError("MySQL transaction connection with execute() is required.");
  }

  return async function runQuery(sql, params = []) {
    const [rows] = await connection.execute(sql, params);
    return rows;
  };
}

/**
 * @returns {(work: (connection: unknown) => Promise<unknown>) => Promise<unknown>}
 */
function getDefaultTransaction() {
  return require("../../../../config/db.js").transaction;
}

module.exports = {
  createConnectionQueryRunner,
  createMySqlEnrollmentClassLinkTransactionRunner,
};
