module.exports = Object.freeze({
  ...require("./enrollment-confirmed.event.js"),
  ...require("./enrollment-draft-created.event.js"),
  ...require("./enrollment-event.helpers.js"),
  ...require("./enrollment-internal-event-dispatcher.js"),
});
