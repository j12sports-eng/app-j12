const { createBiChampionshipsDto } = require("../dtos/bi-championships.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");
class BiChampionshipsService {
  constructor(options = {}) {
    this.repository = options.repository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }
  async getAnalytics(input = {}) {
    const now = validDate(this.now());
    const current = normalizeBiQuery(input, { now });
    const analytics = await this.getRepository().getChampionshipAnalytics({ current });
    return createBiChampionshipsDto({
      analytics: analytics || {},
      filters: Object.freeze({ current }),
      generatedAt: now.toISOString(),
    });
  }
  getRepository() {
    if (!this.repository || typeof this.repository.getChampionshipAnalytics !== "function") {
      throw Object.assign(new TypeError("BiChampionshipsService requires repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    }
    return this.repository;
  }
}
function validDate(value) {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime()))
    throw Object.assign(new TypeError("BI clock invalid."), { code: "BI_CLOCK_INVALID" });
  return result;
}
module.exports = { BiChampionshipsService };
