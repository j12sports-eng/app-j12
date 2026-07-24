module.exports = Object.freeze({
  layer: "infrastructure",
  ...require("./auth-identity.composition.js"),
  ...require("./repositories/index.js"),
  ...require("./user-unit-membership.composition.js"),
});
