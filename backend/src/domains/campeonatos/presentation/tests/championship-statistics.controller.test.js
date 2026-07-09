const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipStatisticsController } = require("../controllers/index.js");

test("ChampionshipStatisticsController delegates statistics and ranking endpoints", async () => {
  const calls = [];
  const controller = new ChampionshipStatisticsController({
    statisticsService: {
      async findRankings(championshipId, filters) {
        calls.push(["findRankings", championshipId, filters.type || ""]);
        return { rankings: { topScorers: [] } };
      },
      async findStatistics(championshipId, filters) {
        calls.push(["findStatistics", championshipId, filters.limit || ""]);
        return { championship: { championshipId } };
      },
      async findTopScorers(championshipId, filters) {
        calls.push(["findTopScorers", championshipId, filters.limit || ""]);
        return { items: [] };
      },
      async recalculate(championshipId) {
        calls.push(["recalculate", championshipId]);
        return { championship: { championshipId } };
      },
    },
  });

  await controller.findStatistics(
    createReq({ params: { championshipId: "camp-1" }, query: { limit: "10" } }),
    createRes(200),
    rethrow,
  );
  await controller.findRankings(
    createReq({ params: { championshipId: "camp-1" }, query: { type: "artilharia" } }),
    createRes(200),
    rethrow,
  );
  await controller.findTopScorers(
    createReq({ params: { championshipId: "camp-1" }, query: { limit: "5" } }),
    createRes(200),
    rethrow,
  );
  await controller.recalculate(
    createReq({ params: { championshipId: "camp-1" } }),
    createRes(200),
    rethrow,
  );

  assert.deepEqual(
    calls.map((call) => call[0]),
    ["findStatistics", "findRankings", "findTopScorers", "recalculate"],
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
