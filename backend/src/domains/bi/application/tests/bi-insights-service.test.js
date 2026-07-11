const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiInsightsService } = require("../index.js");
test("insights service reuses consolidated services with unchanged filters", async () => {
  const calls = [];
  const services = Object.fromEntries(
    ["classes", "courts", "delinquency", "financial", "students"].map((name) => [
      name,
      {
        async getAnalytics(query) {
          calls.push([name, query]);
          return {};
        },
      },
    ]),
  );
  const service = new BiInsightsService({ now: () => new Date("2026-07-10T12:00:00Z"), services });
  const query = { period: "CURRENT_MONTH", unitId: "1" };
  const result = await service.getInsights(query);
  assert.equal(result.contractVersion, "21.11");
  assert.equal(result.readOnly, true);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(([, received]) => received === query));
});
test("insights service rejects invalid filters and missing dependencies", async () => {
  const services = Object.fromEntries(
    ["classes", "courts", "delinquency", "financial", "students"].map((name) => [
      name,
      {
        async getAnalytics() {
          return {};
        },
      },
    ]),
  );
  await assert.rejects(
    new BiInsightsService({ services }).getInsights({ period: "INVALID" }),
    (error) => error.code === "BI_PERIOD_INVALID",
  );
  await assert.rejects(
    new BiInsightsService().getInsights(),
    (error) => error.code === "BI_INSIGHTS_DEPENDENCY_INVALID",
  );
});
