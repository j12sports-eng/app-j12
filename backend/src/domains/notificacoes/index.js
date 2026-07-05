const application = require("./application/index.js");
const infrastructure = require("./infrastructure/index.js");
const presentation = require("./presentation/index.js");

/**
 * Domain boundary for Notificacoes.
 *
 * Sprint 13.13 adds the Agenda notification center while preserving legacy
 * aluno/responsavel notification routes.
 */
module.exports = Object.freeze({
  domain: "notificacoes",
  ...application,
  MySqlNotificationRepository: infrastructure.MySqlNotificationRepository,
  application,
  infrastructure,
  presentation,
});
