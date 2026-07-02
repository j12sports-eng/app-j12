const application = require("./application/index.js");
const infrastructure = require("./infrastructure/index.js");

/**
 * Domain boundary for Classes/Turmas.
 *
 * This entrypoint exposes the new read-only application facade and MySQL
 * adapter without wiring them into existing routes or changing Turmas behavior.
 */
module.exports = Object.freeze({
  domain: "classes",
  ...application,
  MySqlClassRepository: infrastructure.MySqlClassRepository,
  application,
  infrastructure,
});
