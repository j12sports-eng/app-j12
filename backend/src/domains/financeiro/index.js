/**
 * Domain boundary for Financeiro.
 *
 * Runtime routes remain on the existing legacy module. The application exports
 * below are read-only contracts for the gradual domain migration.
 */
module.exports = Object.freeze({
  domain: "financeiro",
  ...require("./application/index.js"),
  ...require("./infrastructure/index.js"),
  ...require("./payment/index.js"),
  ...require("./inter/index.js"),
  ...require("./automation/index.js"),
});
