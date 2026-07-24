module.exports = Object.freeze({
  ...require("./memory-enrollment-digital-invitation.repository.js"),
  ...require("./mysql-enrollment-digital-invitation.repository.js"),
  ...require("./mysql-enrollment.repository.js"),
  ...require("./mysql-enrollment-class-link.repository.js"),
  ...require("./mysql-enrollment-class-link.transaction-runner.js"),
});