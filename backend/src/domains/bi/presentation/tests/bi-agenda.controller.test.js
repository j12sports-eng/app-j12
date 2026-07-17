const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiAgendaController } = require("../controllers/bi-agenda.controller.js");

test("Agenda controller returns aggregate analytics and controlled filter errors", async () => {
  const controller = new BiAgendaController({
    service: {
      async getAnalytics() {
        return { contractVersion: "21.12", readOnly: true };
      },
    },
  });
  const res = response();
  await controller.getAnalytics({ query: {} }, res, fail);
  assert.equal(res.body.data.contractVersion, "21.12");
  assert.equal(res.body.data.readOnly, true);

  const invalid = new BiAgendaController({
    service: {
      getAnalytics() {
        throw Object.assign(new Error("sensitive SQL detail"), {
          code: "BI_PERIOD_INVALID",
          details: { field: "startDate" },
        });
      },
    },
  });
  const invalidResponse = response();
  await invalid.getAnalytics({ query: {} }, invalidResponse, fail);
  assert.equal(invalidResponse.statusCode, 400);
  assert.doesNotMatch(JSON.stringify(invalidResponse.body), /sensitive SQL detail/);
});

test("Agenda controller forwards unexpected errors to centralized handling", async () => {
  const expected = new Error("db");
  let forwarded;
  const controller = new BiAgendaController({
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
