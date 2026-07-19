const infrastructure = require("./infrastructure/index.js");
const application = require("./application/index.js");
const presentation = require("./presentation/index.js");

/**
 * Domain boundary for Enrollments.
 *
 * This entrypoint exposes domain primitives, application contracts/facades/services and
 * infrastructure classes without instantiating or wiring them into current
 * routes, controllers, services, APIs or frontend modules.
 */
module.exports = Object.freeze({
  domain: "enrollments",
  ...require("./domain/index.js"),
  ...require("./application/contracts/index.js"),
  ...require("./application/events/index.js"),
  ...require("./application/facades/enrollment.facade.js"),
  ...require("./application/http/index.js"),
  ...require("./application/services/index.js"),
  MySqlEnrollmentClassLinkRepository: infrastructure.MySqlEnrollmentClassLinkRepository,
  MySqlEnrollmentRepository: infrastructure.MySqlEnrollmentRepository,
  createCanonicalEnrollmentClassLinkFacade: infrastructure.createCanonicalEnrollmentClassLinkFacade,
  createCanonicalEnrollmentClassLinkService:
    infrastructure.createCanonicalEnrollmentClassLinkService,
  createTransactionalClassFacade: infrastructure.createTransactionalClassFacade,
  application,
  infrastructure,
  presentation,
});
