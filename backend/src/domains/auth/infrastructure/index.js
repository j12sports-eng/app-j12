module.exports = Object.freeze({
  layer: "infrastructure",
  ...require("./auth-identity.composition.js"),
  ...require("./middlewares/index.js"),
  ...require("./repositories/index.js"),
  ...require("./unit-context.composition.js"),
  ...require("./user-unit-membership.composition.js"),
});
