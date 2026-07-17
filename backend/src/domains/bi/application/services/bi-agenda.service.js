const { createBiAgendaDto } = require("../dtos/bi-agenda.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");

class BiAgendaService {
  constructor(options = {}) {
    this.repository = options.repository || options.biReadRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async getAnalytics(input = {}) {
    const generatedAt = validDate(this.now());
    const current = normalizeBiQuery(input, { now: generatedAt });
    const analytics = await this.getRepository().getAgendaAnalytics({ current });
    return createBiAgendaDto({
      analytics: analytics || {},
      filters: Object.freeze({ current }),
      generatedAt: generatedAt.toISOString(),
    });
  }

  getRepository() {
    if (!this.repository || typeof this.repository.getAgendaAnalytics !== "function") {
      throw Object.assign(new TypeError("BiAgendaService requires BI Agenda read repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    }
    return this.repository;
  }
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  }
  return date;
}

module.exports = { BiAgendaService };
