module.exports = Object.freeze({
  ...require("./contracts/bi-read.repository.contract.js"),
  ...require("./dtos/bi-foundation.dto.js"),
  ...require("./filters/bi-query.js"),
  ...require("./periods/bi-period.js"),
  ...require("./services/bi-foundation.service.js"),
});
