const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiInsightsController } = require("../controllers/bi-insights.controller.js");
test("insights controller returns contract and maps invalid filters", async () => {
  const res = response();
  await new BiInsightsController({
    service: {
      async getInsights(query) {
        return { query };
      },
    },
  }).getInsights({ query: { period: "CURRENT_MONTH" } }, res, noNext);
  assert.equal(res.body.success, true);
  const invalid = response();
  await new BiInsightsController({
    service: {
      async getInsights() {
        throw Object.assign(new Error("invalid"), { code: "BI_PERIOD_INVALID" });
      },
    },
  }).getInsights({ query: {} }, invalid, noNext);
  assert.equal(invalid.statusCode, 400);
});
function noNext(error) {
  if (error) throw error;
}
function response() {
  return {
    body: null,
    statusCode: 200,
    json(value) {
      this.body = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
  };
}
