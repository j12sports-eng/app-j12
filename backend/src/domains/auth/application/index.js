module.exports = Object.freeze({
  layer: "application",
  ...require("./contracts/index.js"),
  ...require("./services/index.js"),
});
