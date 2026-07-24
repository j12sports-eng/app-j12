module.exports = Object.freeze({
  ...require("./enrollment-admin.controller.js"),
  ...require("./enrollment-invitation-public.controller.js"),
  ...require("./enrollment-internal.controller.js"),
  ...require("./enrollment-public.controller.js"),
});
