module.exports = Object.freeze({
  ...require("./mysql-bi-agenda.repository.js"),
  ...require("./mysql-bi-championships.repository.js"),
  ...require("./mysql-bi-events.repository.js"),
  ...require("./mysql-bi-courts.repository.js"),
  ...require("./mysql-bi-delinquency.repository.js"),
  ...require("./mysql-bi-classes.repository.js"),
  ...require("./mysql-bi-executive.repository.js"),
  ...require("./mysql-bi-financial.repository.js"),
  ...require("./mysql-bi-students.repository.js"),
});
