const { createBiClassesDto } = require("../dtos/bi-classes.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");

class BiClassesService {
  constructor(options = {}) {
    this.repository = options.repository || options.biReadRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }
  async getAnalytics(input = {}) {
    const generatedAt = validDate(this.now());
    const current = normalizeBiQuery(input, { now: generatedAt });
    const analytics = await this.getRepository().getClassOccupancy({ current });
    return createBiClassesDto({
      analytics: analytics || {},
      filters: Object.freeze({ current }),
      generatedAt: generatedAt.toISOString(),
    });
  }
  getRepository() {
    if (!this.repository || typeof this.repository.getClassOccupancy !== "function")
      throw Object.assign(new TypeError("BiClassesService requires BI read repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    return this.repository;
  }
}
function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  return date;
}
module.exports = { BiClassesService };
