module.exports = Object.freeze({
  ...require("./application/services/court-rental.service.js"),
  ...require("./presentation/controllers/court-rental.controller.js"),
  ...require("./presentation/routes/index.js"),
});
