const { PersonRepository } = require("../../pessoas/person.repository.js");
const { PersonProfileRepository } = require("../../pessoas/profiles/person-profile.repository.js");
const {
  PersonRelationshipRepository,
} = require("../../pessoas/relationships/relationship.repository.js");
const {
  MySqlDigitalEnrollmentProgressRepository,
} = require("./repositories/mysql-digital-enrollment-progress.repository.js");
const {
  MySqlEnrollmentRepository,
  createConnectionQueryRunner,
} = require("./repositories/mysql-enrollment.repository.js");

function createDigitalEnrollmentTransactionRunner(options = {}) {
  const connectionProvider = options.connectionProvider || defaultConnectionProvider;
  const repositoryFactory = options.repositoryFactory || createBoundRepositories;

  return async function runDigitalEnrollmentTransaction(callback) {
    const connection = await connectionProvider();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const queryRunner = createConnectionQueryRunner(connection);
      const repositories = repositoryFactory({ connection, queryRunner });
      const result = await callback({ connection, queryRunner, ...repositories });
      await connection.commit();
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch {
          throw transactionError("DIGITAL_ENROLLMENT_ROLLBACK_FAILED");
        }
      }
      if (error?.code) throw error;
      throw transactionError("DIGITAL_ENROLLMENT_TRANSACTION_FAILED");
    } finally {
      try {
        await connection.release();
      } catch {
        if (!transactionStarted) throw transactionError("DIGITAL_ENROLLMENT_RELEASE_FAILED");
      }
    }
  };
}

function createBoundRepositories({ connection, queryRunner }) {
  return {
    digitalEnrollmentProgressRepository: new MySqlDigitalEnrollmentProgressRepository({
      queryRunner,
    }),
    enrollmentRepository: new MySqlEnrollmentRepository({
      connectionProvider: async () => connection,
      queryRunner,
    }),
    personProfileRepository: new PersonProfileRepository({ queryRunner }),
    personRelationshipRepository: new PersonRelationshipRepository({ queryRunner }),
    personRepository: new PersonRepository({ queryRunner }),
  };
}

async function defaultConnectionProvider() {
  return require("../../config/db.js").pool.getConnection();
}

function transactionError(code) {
  const error = new Error("Digital enrollment transaction failed.");
  error.code = code;
  error.statusCode = 500;
  return error;
}

module.exports = {
  createBoundRepositories,
  createDigitalEnrollmentTransactionRunner,
  transactionError,
};
