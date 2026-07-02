/**
 * Domain boundary for Pessoas.
 *
 * This entrypoint exposes only future-domain primitives. It is not imported by
 * current routes, controllers, services or frontend modules.
 */
module.exports = Object.freeze({
  domain: "pessoas",
  ...require("./person.entity.js"),
  ...require("./person.mapper.js"),
  ...require("./person.repository.js"),
  ...require("./person.service.js"),
  ...require("./person.validator.js"),
});
