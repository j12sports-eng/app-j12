const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiClassesController } = require("../controllers/bi-classes.controller.js");
test("classes controller returns analytics and controlled filter errors", async () => {
  const controller = new BiClassesController({
    service: {
      async getAnalytics() {
        return { contractVersion: "21.5" };
      },
    },
  });
  const res = response();
  await controller.getAnalytics({ query: {} }, res, fail);
  assert.equal(res.body.data.contractVersion, "21.5");
  const invalid = new BiClassesController({
    service: {
      getAnalytics() {
        throw Object.assign(new Error(), { code: "BI_FILTER_INVALID" });
      },
    },
  });
  const invalidResponse = response();
  await invalid.getAnalytics({ query: {} }, invalidResponse, fail);
  assert.equal(invalidResponse.statusCode, 400);
});
test("classes controller forwards unexpected errors", async () => {
  const expected = new Error("db");
  let forwarded;
  const controller = new BiClassesController({
    service: {
      getAnalytics() {
        throw expected;
      },
    },
  });
  await controller.getAnalytics({ query: {} }, response(), (error) => {
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
