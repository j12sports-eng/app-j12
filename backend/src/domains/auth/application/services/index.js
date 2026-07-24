module.exports = Object.freeze({
  ...require("./actor-context-factory.service.js"),
  ...require("./auth-identity-application.service.js"),
  ...require("./authenticated-auth-identity-resolver.service.js"),
  ...require("./unit-context-resolver.service.js"),
  ...require("./user-unit-membership-application.service.js"),
});
