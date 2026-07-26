module.exports = Object.freeze({
  layer: "domain",
  ...require("./entities/index.js"),
  ...require("./enums/index.js"),
  ...require("./factories/index.js"),
  ...require("./policies/index.js"),
  ...require("./value-objects/index.js"),
});
