const { createBiDelinquencyDto } = require("../dtos/bi-delinquency.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");
class BiDelinquencyService {
  constructor(options = {}) {
    this.repository = options.repository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }
  async getAnalytics(input = {}) {
    const generatedAt = date(this.now());
    const current = normalizeBiQuery(input, { now: generatedAt });
    const analytics = await this.getRepository().getDelinquencyAnalytics({ current });
    return createBiDelinquencyDto({
      analytics: analytics || {},
      filters: Object.freeze({ current }),
      generatedAt: generatedAt.toISOString(),
    });
  }
  getRepository() {
    if (!this.repository || typeof this.repository.getDelinquencyAnalytics !== "function")
      throw Object.assign(new TypeError("BiDelinquencyService requires BI read repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    return this.repository;
  }
}
function date(value) {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime()))
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  return result;
}
module.exports = { BiDelinquencyService };
