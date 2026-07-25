const FOUNDATION_BLOCKER = "DIGITAL_ENROLLMENT_CONTRACT_TEMPLATE_SELECTION_NOT_CANONICAL";
const PUBLIC_ERROR_CODE = "DIGITAL_ENROLLMENT_CONTRACT_NOT_AVAILABLE";

class DigitalEnrollmentContractService {
  constructor({ applicableTemplateSelector = null, logger = null } = {}) {
    this.applicableTemplateSelector = applicableTemplateSelector;
    this.logger = logger;
  }
  async getContract() { return this.block("getContract"); }
  async getAcceptanceStatus() { return this.block("getAcceptanceStatus"); }
  async acceptContract() { return this.block("acceptContract"); }
  async findApplicableTemplate(context = {}) {
    if (!this.applicableTemplateSelector?.findApplicableTemplate) return this.block("findApplicableTemplate");
    const result = await this.applicableTemplateSelector.findApplicableTemplate(context);
    if (!result) return this.block("findApplicableTemplate");
    return result;
  }
  async createContractForEnrollment(context = {}) {
    await this.findApplicableTemplate(context);
    return this.block("createContractForEnrollment");
  }
  async supersedeContract() { return this.block("supersedeContract"); }
  async publishTemplate() { return this.block("publishTemplate"); }
  async archiveTemplate() { return this.block("archiveTemplate"); }
  block(operation) {
    this.logger?.warn?.("[enrollments] digital contract foundation blocked", {
      blocker: FOUNDATION_BLOCKER,
      operation,
      result: "blocked",
    });
    const error = new Error("Digital enrollment contract is not available.");
    error.code = PUBLIC_ERROR_CODE;
    error.blocker = FOUNDATION_BLOCKER;
    error.statusCode = 503;
    error.expose = false;
    throw error;
  }
}
module.exports = { DigitalEnrollmentContractService, FOUNDATION_BLOCKER, PUBLIC_ERROR_CODE };
