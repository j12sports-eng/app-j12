const { createBiEventsDto } = require("../dtos/bi-events.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");
class BiEventsService {
  constructor(options = {}) {
    this.repository = options.repository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }
  async getAnalytics(input = {}) {
    const now = validDate(this.now());
    const current = normalizeBiQuery(input, { now });
    if (current.unitId) {
      throw Object.assign(new TypeError("BI Events does not support unitId."), {
        code: "BI_FILTER_INVALID",
        details: { field: "unitId", reason: "EVENTS_WITHOUT_CANONICAL_UNIT" },
      });
    }
    const analytics = await this.getRepository().getEventAnalytics({
      current, today: now.toISOString().slice(0, 10),
    });
    return createBiEventsDto({
      analytics: analytics || {}, filters: Object.freeze({ current }),
      generatedAt: now.toISOString(),
    });
  }
  getRepository() {
    if (!this.repository || typeof this.repository.getEventAnalytics !== "function") {
      throw Object.assign(new TypeError("BiEventsService requires repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    }
    return this.repository;
  }
}
function validDate(value) {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw Object.assign(new TypeError("BI clock invalid."), { code: "BI_CLOCK_INVALID" });
  }
  return result;
}
module.exports = { BiEventsService };
