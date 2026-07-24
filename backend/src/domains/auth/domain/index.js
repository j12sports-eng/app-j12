module.exports = Object.freeze({
  layer: "domain",
  ...require("./entities/index.js"),
  ...require("./enums/index.js"),
});
