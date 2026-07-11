const { normalizeBiQuery } = require("../filters/bi-query.js");
const { BiInsightEngine } = require("../insights/bi-insight.engine.js");

class BiInsightsService {
  constructor(options = {}) {
    this.services = options.services || {};
    this.engine = options.engine || new BiInsightEngine({ thresholds: options.thresholds });
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }
  async getInsights(query = {}) {
    const now = validDate(this.now());
    normalizeBiQuery(query, { now });
    const [classes, courts, delinquency, financial, students] = await Promise.all([
      this.call("classes", query),
      this.call("courts", query),
      this.call("delinquency", query),
      this.call("financial", query),
      this.call("students", query),
    ]);
    return Object.freeze({
      contractVersion: "21.11",
      generatedAt: now.toISOString(),
      insights: this.engine.generate({
        classes,
        courts,
        delinquency,
        financial,
        generatedAt: now.toISOString(),
        students,
      }),
      readOnly: true,
      thresholds: this.engine.thresholds,
    });
  }
  call(name, query) {
    const service = this.services[name];
    if (!service || typeof service.getAnalytics !== "function")
      throw Object.assign(new TypeError(`BI insights dependency ${name} is invalid.`), {
        code: "BI_INSIGHTS_DEPENDENCY_INVALID",
      });
    return service.getAnalytics(query);
  }
}
function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw Object.assign(new TypeError("BI clock is invalid."), { code: "BI_CLOCK_INVALID" });
  return date;
}
module.exports = { BiInsightsService };
