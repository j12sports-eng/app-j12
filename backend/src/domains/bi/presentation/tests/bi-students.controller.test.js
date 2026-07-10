const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiStudentsController } = require("../controllers/bi-students.controller.js");
test("students controller delegates filters", async () => {
  let filters;
  const controller = new BiStudentsController({
    service: {
      async getAnalytics(input) {
        filters = input;
        return { contractVersion: "21.4" };
      },
    },
  });
  const res = response();
  await controller.getAnalytics({ query: { period: "TODAY" } }, res, fail);
  assert.deepEqual(filters, { period: "TODAY" });
  assert.equal(res.body.data.contractVersion, "21.4");
});
test("students controller handles invalid filter and unexpected failure", async () => {
  const invalid = new BiStudentsController({
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
  const unexpected = new BiStudentsController({
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
