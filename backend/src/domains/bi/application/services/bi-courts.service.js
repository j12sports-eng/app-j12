const { createBiCourtsDto } = require("../dtos/bi-courts.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");
class BiCourtsService {
  constructor(o = {}) {
    this.repository = o.repository || null;
    this.now = typeof o.now === "function" ? o.now : () => new Date();
  }
  async getAnalytics(input = {}) {
    const now = date(this.now());
    const current = normalizeBiQuery(input, { now });
    const analytics = await this.repo().getCourtAnalytics({ current });
    return createBiCourtsDto({
      analytics: analytics || {},
      filters: Object.freeze({ current }),
      generatedAt: now.toISOString(),
    });
  }
  repo() {
    if (!this.repository || typeof this.repository.getCourtAnalytics !== "function")
      throw Object.assign(new TypeError("BiCourtsService requires repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    return this.repository;
  }
}
function date(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime()))
    throw Object.assign(new TypeError("BI clock invalid."), { code: "BI_CLOCK_INVALID" });
  return d;
}
module.exports = { BiCourtsService };
