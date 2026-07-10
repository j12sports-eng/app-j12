module.exports = Object.freeze({
  ...require("./contracts/bi-read.repository.contract.js"),
  ...require("./dtos/bi-foundation.dto.js"),
  ...require("./dtos/bi-students.dto.js"),
  ...require("./dtos/bi-financial.dto.js"),
  ...require("./dtos/bi-executive.dto.js"),
  ...require("./filters/bi-query.js"),
  ...require("./periods/bi-period.js"),
  ...require("./services/bi-foundation.service.js"),
  ...require("./services/bi-students.service.js"),
  ...require("./services/bi-financial.service.js"),
  ...require("./services/bi-executive.service.js"),
});
