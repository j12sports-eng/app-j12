module.exports = Object.freeze({
  ...require("./mysql-digital-enrollment-administrative-review.repository.js"),
  ...require("./mysql-digital-enrollment-administrative-review.transaction-runner.js"),
  ...require("./memory-digital-enrollment-administrative-review.repository.js"),
  ...require("./memory-enrollment-digital-invitation.repository.js"),
  ...require("./mysql-enrollment-digital-invitation.repository.js"),
  ...require("./mysql-enrollment.repository.js"),
  ...require("./mysql-enrollment-class-link.repository.js"),
  ...require("./mysql-enrollment-class-link.transaction-runner.js"),
});