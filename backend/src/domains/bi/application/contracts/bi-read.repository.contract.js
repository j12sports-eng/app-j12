const BiReadRepositoryCapability = Object.freeze({
  available: true,
  capabilities: Object.freeze(["EXECUTIVE_SNAPSHOT"]),
  reason: null,
});

class BiReadRepositoryContract {
  async getExecutiveSnapshot() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getExecutiveSnapshot."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }

  async getFinancialAnalytics() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getFinancialAnalytics."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }
}

module.exports = { BiReadRepositoryCapability, BiReadRepositoryContract };
