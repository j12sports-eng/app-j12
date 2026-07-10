const BiReadRepositoryCapability = Object.freeze({
  available: true,
  capabilities: Object.freeze(["EXECUTIVE_SNAPSHOT"]),
  reason: null,
});

class BiReadRepositoryContract {
  async getCourtAnalytics() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getCourtAnalytics."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }
  async getDelinquencyAnalytics() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getDelinquencyAnalytics."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }

  async getClassOccupancy() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getClassOccupancy."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }

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

  async getStudentAnalytics() {
    throw Object.assign(
      new TypeError("BiReadRepositoryContract must implement getStudentAnalytics."),
      { code: "BI_REPOSITORY_NOT_IMPLEMENTED" },
    );
  }
}

module.exports = { BiReadRepositoryCapability, BiReadRepositoryContract };
