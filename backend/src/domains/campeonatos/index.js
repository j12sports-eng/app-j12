module.exports = Object.freeze({
  ...require("./application/index.js"),
  ...require("./domain/index.js"),
  ...require("./infrastructure/index.js"),
  ...require("./presentation/index.js"),
  ...require("./shared/index.js"),
});
