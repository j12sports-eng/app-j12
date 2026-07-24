module.exports = Object.freeze({
  ...require("./enrollment-digital-invitation.composition.js"),
  layer: "infrastructure",
  ...require("./enrollment-class-link.composition.js"),
  ...require("./repositories/index.js"),
});