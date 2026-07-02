const application = require("./application/index.js");
const infrastructure = require("./infrastructure/index.js");

/**
 * Domain boundary for Agenda.
 *
 * This entrypoint exposes the new read-only application facade and MySQL
 * adapter without wiring them into existing routes or changing Agenda,
 * attendance, finance, notification or public API behavior.
 */
module.exports = Object.freeze({
  domain: "agenda",
  ...application,
  MySqlAgendaRepository: infrastructure.MySqlAgendaRepository,
  application,
  infrastructure,
});
