const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRoundController } = require("../controllers/index.js");

test("ChampionshipRoundController delegates round lifecycle to service", async () => {
  const calls = [];
  const controller = new ChampionshipRoundController({
    roundService: {
      async createRound(championshipId, payload, context) {
        calls.push(["createRound", championshipId, payload.name, context.auth.email]);
        return { championshipId, id: "rodada-1", ...payload };
      },
      async findRoundById(championshipId, roundId) {
        calls.push(["findRoundById", championshipId, roundId]);
        return { championshipId, id: roundId };
      },
      async findRoundsByChampionship(championshipId, filters) {
        calls.push(["findRoundsByChampionship", championshipId, filters.search]);
        return { items: [{ id: "rodada-1" }], limit: 20, page: 1, total: 1 };
      },
      async updateRound(championshipId, roundId, payload, context) {
        calls.push(["updateRound", championshipId, roundId, payload.name, context.auth.email]);
        return { championshipId, id: roundId, ...payload };
      },
    },
  });

  await controller.createRound(
    createReq({ body: { name: "Rodada 1" }, params: { championshipId: "camp-1" } }),
    createRes(201),
    rethrow,
  );
  await controller.findRoundsByChampionship(
    createReq({ params: { championshipId: "camp-1" }, query: { search: "rodada" } }),
    createRes(200),
    rethrow,
  );
  await controller.findRoundById(
    createReq({ params: { championshipId: "camp-1", roundId: "rodada-1" } }),
    createRes(200),
    rethrow,
  );
  await controller.updateRound(
    createReq({
      body: { name: "Rodada Alpha" },
      params: { championshipId: "camp-1", roundId: "rodada-1" },
    }),
    createRes(200),
    rethrow,
  );

  assert.deepEqual(
    calls.map((call) => call[0]),
    ["createRound", "findRoundsByChampionship", "findRoundById", "updateRound"],
  );
});

test("ChampionshipRoundController delegates match lifecycle and generation", async () => {
  const calls = [];
  const controller = new ChampionshipRoundController({
    roundService: {
      async createMatch(championshipId, roundId, payload) {
        calls.push(["createMatch", championshipId, roundId, payload.homeRegistrationId]);
        return { championshipId, id: "jogo-1", roundId, ...payload };
      },
      async deleteMatch(championshipId, matchId) {
        calls.push(["deleteMatch", championshipId, matchId]);
        return { championshipId, id: matchId };
      },
      async deleteRound(championshipId, roundId) {
        calls.push(["deleteRound", championshipId, roundId]);
        return { championshipId, id: roundId };
      },
      async findMatches(championshipId, filters) {
        calls.push(["findMatches", championshipId, filters.status]);
        return { items: [{ id: "jogo-1" }], limit: 20, page: 1, total: 1 };
      },
      async generateMatches(championshipId, payload) {
        calls.push(["generateMatches", championshipId, payload.replace]);
        return { generated: 1, items: [], limit: 100, page: 1, total: 0 };
      },
      async moveMatch(championshipId, matchId, payload) {
        calls.push(["moveMatch", championshipId, matchId, payload.targetRoundId]);
        return { championshipId, id: matchId, roundId: payload.targetRoundId };
      },
      async updateMatch(championshipId, matchId, payload) {
        calls.push(["updateMatch", championshipId, matchId, payload.status]);
        return { championshipId, id: matchId, ...payload };
      },
    },
  });
  const params = { championshipId: "camp-1", matchId: "jogo-1", roundId: "rodada-1" };

  await controller.createMatch(
    createReq({ body: { homeRegistrationId: "insc-1" }, params }),
    createRes(201),
    rethrow,
  );
  await controller.findMatches(
    createReq({ params: { championshipId: "camp-1" }, query: { status: "SCHEDULED" } }),
    createRes(200),
    rethrow,
  );
  await controller.updateMatch(
    createReq({ body: { status: "POSTPONED" }, params }),
    createRes(200),
    rethrow,
  );
  await controller.moveMatch(
    createReq({ body: { targetRoundId: "rodada-2" }, params }),
    createRes(200),
    rethrow,
  );
  await controller.generateMatches(
    createReq({ body: { replace: true }, params: { championshipId: "camp-1" } }),
    createRes(200),
    rethrow,
  );
  await controller.deleteMatch(createReq({ params }), createRes(200), rethrow);
  await controller.deleteRound(createReq({ params }), createRes(200), rethrow);

  assert.deepEqual(
    calls.map((call) => call[0]),
    [
      "createMatch",
      "findMatches",
      "updateMatch",
      "moveMatch",
      "generateMatches",
      "deleteMatch",
      "deleteRound",
    ],
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
