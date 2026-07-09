const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipStandingController } = require("../controllers/index.js");

test("ChampionshipStandingController delegates standing queries and recalculation", async () => {
  const calls = [];
  const controller = new ChampionshipStandingController({
    standingService: {
      async findAll(championshipId, filters) {
        calls.push(["findAll", championshipId, filters.groupId || ""]);
        return { items: [{ id: "classificacao-1" }], limit: 100, page: 1, total: 1 };
      },
      async findByGroup(championshipId, groupId, filters) {
        calls.push(["findByGroup", championshipId, groupId, filters.criteria || ""]);
        return { items: [{ id: "classificacao-2" }], limit: 100, page: 1, total: 1 };
      },
      async recalculate(championshipId, payload) {
        calls.push(["recalculate", championshipId, payload.criteria?.[0] || ""]);
        return { items: [], limit: 100, page: 1, total: 0 };
      },
    },
  });

  await controller.findAll(
    createReq({ params: { championshipId: "camp-1" }, query: { groupId: "grupo-1" } }),
    createRes(200),
    rethrow,
  );
  await controller.findByGroup(
    createReq({
      params: { championshipId: "camp-1", groupId: "grupo-1" },
      query: { criteria: "points,wins" },
    }),
    createRes(200),
    rethrow,
  );
  await controller.recalculate(
    createReq({ body: { criteria: ["points"] }, params: { championshipId: "camp-1" } }),
    createRes(200),
    rethrow,
  );

  assert.deepEqual(
    calls.map((call) => call[0]),
    ["findAll", "findByGroup", "recalculate"],
  );
});

function createReq({ body = {}, params = {}, query = {} } = {}) {
  return {
    auth: { email: "admin@j12.test" },
    body,
    params,
    query,
  };
}

function createRes(expectedStatus) {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      assert.equal(this.statusCode, expectedStatus);
      assert.equal(payload.success, true);
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function rethrow(error) {
  throw error;
}
