module.exports = Object.freeze({
  ...require("./enrollment-admin.routes.js"),
  ...require("./enrollment-invitation-admin.routes.js"),
  ...require("./enrollment-invitation-public.routes.js"),
  ...require("./enrollment-internal.routes.js"),
  ...require("./enrollment-public.routes.js"),
});
