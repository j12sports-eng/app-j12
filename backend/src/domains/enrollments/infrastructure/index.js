module.exports = Object.freeze({
  layer: "infrastructure",
  ...require("./enrollment-class-link.composition.js"),
  ...require("./repositories/index.js"),
});
