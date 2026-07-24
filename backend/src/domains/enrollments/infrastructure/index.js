module.exports = Object.freeze({
  ...require("./enrollment-digital-invitation.composition.js"),
  ...require("./enrollment-invitation-admin.composition.js"),
  ...require("./enrollment-public.composition.js"),
  layer: "infrastructure",
  ...require("./enrollment-class-link.composition.js"),
  ...require("./repositories/index.js"),
});