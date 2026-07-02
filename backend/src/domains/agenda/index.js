const application = require("./application/index.js");
const infrastructure = require("./infrastructure/index.js");

/**
 * Domain boundary for Agenda.
 *
 * This entrypoint exposes the application facade and MySQL adapter for
 * schedule discovery and controlled initial planned Agenda persistence without
 * changing attendance, finance, notification or public API behavior.
 */
module.exports = Object.freeze({
  domain: "agenda",
  ...application,
  MySqlAgendaRepository: infrastructure.MySqlAgendaRepository,
  application,
  infrastructure,
});
