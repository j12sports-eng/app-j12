class FinancialReportRepository {
  async getFinancialOverview() {
    throw notImplemented("getFinancialOverview");
  }
  async getInstallmentsReport() {
    throw notImplemented("getInstallmentsReport");
  }
  async getDelinquencyReport() {
    throw notImplemented("getDelinquencyReport");
  }
  async getPixReport() {
    throw notImplemented("getPixReport");
  }
  async getAutomationsReport() {
    throw notImplemented("getAutomationsReport");
  }
}

function notImplemented(method) {
  const error = new TypeError(`FinancialReportRepository must implement ${method}.`);
  error.code = "FINANCIAL_REPORT_REPOSITORY_NOT_IMPLEMENTED";
  return error;
}

module.exports = { FinancialReportRepository };
