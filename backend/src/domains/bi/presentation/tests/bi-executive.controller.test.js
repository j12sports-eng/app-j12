const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiExecutiveController } = require("../controllers/bi-executive.controller.js");

test("executive controller delegates valid filters", async () => {
  let filters;
  const controller = new BiExecutiveController({
    service: {
      async getDashboard(input) {
        filters = input;
        return { contractVersion: "21.2" };
      },
    },
  });
  const res = response();
  await controller.getDashboard({ query: { period: "TODAY" } }, res, fail);
  assert.deepEqual(filters, { period: "TODAY" });
  assert.equal(res.body.success, true);
});
test("executive controller returns 400 for invalid filters and forwards unexpected errors", async () => {
  const controlled = new BiExecutiveController({
    service: {
      getDashboard() {
        throw Object.assign(new Error(), { code: "BI_PERIOD_INVALID" });
      },
    },
  });
  const res = response();
  await controlled.getDashboard({ query: {} }, res, fail);
  assert.equal(res.statusCode, 400);
  const expected = new Error("database");
  let forwarded;
  const unexpected = new BiExecutiveController({
    service: {
      getDashboard() {
        throw expected;
      },
    },
  });
  await unexpected.getDashboard({ query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded, expected);
});
function response() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}
function fail(error) {
  if (error) throw error;
}
