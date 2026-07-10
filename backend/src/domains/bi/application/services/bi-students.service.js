const { createBiStudentsDto } = require("../dtos/bi-students.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");
const { previousPeriod } = require("./bi-executive.service.js");

class BiStudentsService {
  constructor(options = {}) {
    this.repository = options.repository || options.biReadRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async getAnalytics(input = {}) {
    const generatedAt = validDate(this.now());
    const current = normalizeBiQuery(input, { now: generatedAt });
    const previous = previousPeriod(current);
    const analytics = await this.getRepository().getStudentAnalytics({ current, previous });
    return createBiStudentsDto({
      analytics: analytics || {},
      filters: Object.freeze({ current, previous }),
      generatedAt: generatedAt.toISOString(),
    });
  }

  getRepository() {
    if (!this.repository || typeof this.repository.getStudentAnalytics !== "function") {
      throw Object.assign(new TypeError("BiStudentsService requires BI read repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    }
    return this.repository;
  }
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  return date;
}

module.exports = { BiStudentsService };
