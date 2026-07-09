module.exports = {
  ...require("./financial-admin.routes.js"),
  ...require("../../payment/presentation/routes/index.js"),
  ...require("../../inter/presentation/routes/inter-admin.routes.js"),
  ...require("../../automation/presentation/routes/index.js"),
};
