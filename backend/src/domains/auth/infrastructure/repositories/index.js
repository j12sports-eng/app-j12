module.exports = Object.freeze({
  ...require("./memory-auth-identity.repository.js"),
  ...require("./mysql-auth-identity.repository.js"),
});
