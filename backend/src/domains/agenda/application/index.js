module.exports = Object.freeze({
  layer: "application",
  ...require("./facades/index.js"),
  ...require("./repositories/index.js"),
  ...require("./services/index.js"),
});
