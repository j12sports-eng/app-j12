module.exports = Object.freeze({
  ...require("./mysql-enrollment.repository.js"),
  ...require("./mysql-enrollment-class-link.repository.js"),
  ...require("./mysql-enrollment-class-link.transaction-runner.js"),
});
