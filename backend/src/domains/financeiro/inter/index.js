module.exports = Object.freeze({
  ...require("./application/dtos/inter.dto.js"),
  ...require("./application/services/inter-application.service.js"),
  ...require("./application/validators/inter.validators.js"),
  ...require("./entities/inter-payment.entity.js"),
  ...require("./infrastructure/clients/banco-inter.client.js"),
  ...require("./infrastructure/repositories/mysql-inter.repository.js"),
  ...require("./presentation/controllers/inter-admin.controller.js"),
  ...require("./presentation/routes/inter-admin.routes.js"),
});
