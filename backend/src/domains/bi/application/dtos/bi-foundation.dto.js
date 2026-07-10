const { SharedConstants } = require("../../../../core/shared/shared-constants.js");
const { BiPeriod } = require("../periods/bi-period.js");
const { BiReadRepositoryCapability } = require("../contracts/bi-read.repository.contract.js");

function createBiFoundationDto(query) {
  return Object.freeze({
    capabilities: Object.freeze({
      foundation: true,
      metrics: BiReadRepositoryCapability.available,
      reports: false,
    }),
    contractVersion: "21.1",
    filters: Object.freeze({
      applied: query,
      supported: Object.freeze(["period", "startDate", "endDate", "unitId"]),
    }),
    readOnly: true,
    repository: BiReadRepositoryCapability,
    supportedPeriods: Object.freeze(Object.values(BiPeriod)),
    timezone: SharedConstants.DEFAULT_TIMEZONE,
  });
}

module.exports = { createBiFoundationDto };
