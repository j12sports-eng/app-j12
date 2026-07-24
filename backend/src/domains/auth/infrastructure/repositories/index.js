module.exports = Object.freeze({
  ...require("./memory-auth-identity.repository.js"),
  ...require("./memory-user-unit-membership.repository.js"),
  ...require("./mysql-auth-identity.repository.js"),
  ...require("./mysql-user-unit-membership.repository.js"),
});
