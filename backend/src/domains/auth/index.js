const application = require("./application/index.js");
const domainModel = require("./domain/index.js");
const infrastructure = require("./infrastructure/index.js");

/**
 * Domain boundary for authentication identities.
 *
 * This entrypoint exposes the canonical identity foundation without changing
 * current login, JWT payloads, req.user shape, routes or authorization rules.
 */
module.exports = Object.freeze({
  application,
  domain: "auth",
  domainModel,
  infrastructure,
  ...domainModel,
  ...application,
  ...infrastructure,
});
