module.exports = Object.freeze({
  ...require("./agenda-application.service.js"),
  ...require("./agenda-conflict-validation.service.js"),
  ...require("./agenda-recurrence.service.js"),
});
