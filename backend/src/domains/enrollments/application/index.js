module.exports = Object.freeze({
  layer: "application",
  ...require("./contracts/index.js"),
  ...require("./events/index.js"),
  ...require("./facades/enrollment.facade.js"),
  ...require("./http/index.js"),
  ...require("./repositories/index.js"),
  ...require("./security/index.js"),
  ...require("./services/index.js"),
});
