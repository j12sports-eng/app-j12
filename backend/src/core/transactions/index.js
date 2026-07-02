/**
 * Transaction infrastructure boundary.
 *
 * This module is intentionally isolated in Sprint 9.2. It is not wired into
 * controllers, services, repositories, routes or database drivers.
 */
module.exports = Object.freeze({
  ...require("./BaseUseCase.js"),
  ...require("./TransactionContext.js"),
  ...require("./TransactionManager.js"),
  ...require("./UnitOfWork.js"),
});
