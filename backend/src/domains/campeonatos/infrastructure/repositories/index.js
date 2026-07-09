module.exports = Object.freeze({
  ...require("./mysql-championship-bracket.repository.js"),
  ...require("./mysql-championship.repository.js"),
  ...require("./mysql-championship-group.repository.js"),
  ...require("./mysql-championship-match-report.repository.js"),
  ...require("./mysql-championship-registration-player.repository.js"),
  ...require("./mysql-championship-registration.repository.js"),
  ...require("./mysql-championship-round.repository.js"),
  ...require("./mysql-championship-standing.repository.js"),
  ...require("./mysql-championship-statistics.repository.js"),
});
