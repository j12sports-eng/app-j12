function createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner({
  connectionProvider = null,
} = {}) {
  const getConnection =
    connectionProvider || getDefaultConnectionProvider();

  if (typeof getConnection !== "function") {
    throw new TypeError(
      "Administrative review transaction connection provider is required.",
    );
  }

  return async function runAdministrativeReviewTransaction(work) {
    if (typeof work !== "function") {
      throw new TypeError(
        "Administrative review transaction work must be a function.",
      );
    }

    const connection = await getConnection();
    assertConnection(connection);

    let transactionStarted = false;
    let primaryError = null;

    try {
      await connection.beginTransaction();
      transactionStarted = true;

      const queryRunner = createConnectionQueryRunner(connection);
      const result = await work(queryRunner);

      await connection.commit();
      transactionStarted = false;

      return result;
    } catch (error) {
      primaryError = error;

      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          attachSecondaryError(error, "rollbackError", rollbackError);
        }
      }

      throw error;
    } finally {
      try {
        await connection.release();
      } catch (releaseError) {
        if (primaryError) {
          attachSecondaryError(primaryError, "releaseError", releaseError);
        } else {
          throw releaseError;
        }
      }
    }
  };
}

function createConnectionQueryRunner(connection) {
  assertConnection(connection);

  return async function runQuery(sql, params = []) {
    if (typeof sql !== "string" || !sql.trim()) {
      throw new TypeError(
        "Administrative review SQL statement is required.",
      );
    }

    if (!Array.isArray(params)) {
      throw new TypeError(
        "Administrative review SQL parameters must be an array.",
      );
    }

    const [result] = await connection.execute(sql, params);
    return result;
  };
}

function assertConnection(connection) {
  if (!connection || typeof connection !== "object") {
    throw new TypeError(
      "Administrative review MySQL connection is required.",
    );
  }

  for (const method of [
    "beginTransaction",
    "commit",
    "execute",
    "release",
    "rollback",
  ]) {
    if (typeof connection[method] !== "function") {
      throw new TypeError(
        `MySQL administrative review connection requires ${method}().`,
      );
    }
  }
}

function attachSecondaryError(primaryError, property, secondaryError) {
  try {
    Object.defineProperty(primaryError, property, {
      configurable: true,
      enumerable: false,
      value: secondaryError,
      writable: false,
    });
  } catch {
    // O erro principal deve ser preservado mesmo se não puder ser enriquecido.
  }
}

function getDefaultConnectionProvider() {
  return async function provideConnection() {
    const db = require("../../../../config/db.js");

    if (typeof db?.pool?.getConnection !== "function") {
      throw new TypeError(
        "MySQL pool connection provider is not configured.",
      );
    }

    return db.pool.getConnection();
  };
}

module.exports = {
  createConnectionQueryRunner,
  createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner,
};