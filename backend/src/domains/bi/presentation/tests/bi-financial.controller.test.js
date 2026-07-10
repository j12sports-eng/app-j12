const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiFinancialController } = require("../controllers/bi-financial.controller.js");

test("financial BI controller delegates filters and returns contract", async () => {
  let filters;
  const controller = new BiFinancialController({
    service: {
      async getAnalytics(input) {
        filters = input;
        return { contractVersion: "21.3" };
      },
    },
  });
  const res = response();
  await controller.getAnalytics({ query: { period: "TODAY" } }, res, fail);
  assert.deepEqual(filters, { period: "TODAY" });
  assert.equal(res.body.data.contractVersion, "21.3");
});
test("financial BI controller maps invalid filters and forwards unexpected errors", async () => {
  const invalid = new BiFinancialController({
    service: {
      getAnalytics() {
        throw Object.assign(new Error(), { code: "BI_FILTER_INVALID" });
      },
    },
  });
  const res = response();
  await invalid.getAnalytics({ query: {} }, res, fail);
  assert.equal(res.statusCode, 400);
  const expected = new Error("db");
  let forwarded;
  const unexpected = new BiFinancialController({
    service: {
      getAnalytics() {
        throw expected;
      },
    },
  });
  await unexpected.getAnalytics({ query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded, expected);
});
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
function fail(error) {
  if (error) throw error;
}
