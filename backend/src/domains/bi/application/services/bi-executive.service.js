const { createBiExecutiveDto } = require("../dtos/bi-executive.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");

class BiExecutiveService {
  constructor(options = {}) {
    this.repository = options.repository || options.biReadRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async getDashboard(input = {}) {
    const generatedAt = validDate(this.now());
    const current = normalizeBiQuery(input, { now: generatedAt });
    const previous = previousPeriod(current);
    const snapshot = await this.getRepository().getExecutiveSnapshot({ current, previous });
    return createBiExecutiveDto({
      current: snapshot.current || {},
      filters: Object.freeze({ current, previous }),
      generatedAt: generatedAt.toISOString(),
      previous: snapshot.previous || {},
    });
  }

  getRepository() {
    if (!this.repository || typeof this.repository.getExecutiveSnapshot !== "function") {
      throw Object.assign(new TypeError("BiExecutiveService requires BI read repository."), {
        code: "BI_REPOSITORY_INVALID",
      });
    }
    return this.repository;
  }
}

function previousPeriod(current) {
  const start = new Date(`${current.startDate}T00:00:00.000Z`);
  const end = new Date(`${current.endDate}T00:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = addDays(current.startDate, -1);
  return Object.freeze({
    endDate: previousEnd,
    startDate: addDays(previousEnd, -(days - 1)),
    timezone: current.timezone,
    unitId: current.unitId,
  });
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  return date;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

module.exports = { BiExecutiveService, previousPeriod };
