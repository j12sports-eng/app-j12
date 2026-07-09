const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRegistrationPlayerController } = require("../controllers/index.js");

test("ChampionshipRegistrationPlayerController delegates create and list to service", async () => {
  const calls = [];
  const controller = new ChampionshipRegistrationPlayerController({
    playerService: {
      async create(registrationId, payload) {
        calls.push(["create", registrationId, payload.name]);
        return { id: "player-1", registrationId, ...payload };
      },
      async findAll(registrationId, filters) {
        calls.push(["findAll", registrationId, filters.search]);
        return { items: [{ id: "player-1" }], limit: 20, page: 1, total: 1 };
      },
    },
  });

  await controller.create(
    createReq({ body: { name: "Ana", shirtNumber: 10 }, params: { registrationId: "insc-1" } }),
    createRes(201),
    rethrow,
  );
  await controller.findAll(
    createReq({ params: { registrationId: "insc-1" }, query: { search: "ana" } }),
    createRes(200),
    rethrow,
  );

  assert.deepEqual(calls, [
    ["create", "insc-1", "Ana"],
    ["findAll", "insc-1", "ana"],
  ]);
});

test("ChampionshipRegistrationPlayerController delegates update, delete and captain", async () => {
  const calls = [];
  const controller = new ChampionshipRegistrationPlayerController({
    playerService: {
      async delete(registrationId, playerId) {
        calls.push(["delete", registrationId, playerId]);
        return { active: false, id: playerId };
      },
      async findById(registrationId, playerId) {
        calls.push(["findById", registrationId, playerId]);
        return { id: playerId, registrationId };
      },
      async setCaptain(registrationId, playerId, payload) {
        calls.push(["setCaptain", registrationId, playerId, payload.captain]);
        return { captain: true, id: playerId };
      },
      async update(registrationId, playerId, payload) {
        calls.push(["update", registrationId, playerId, payload.name]);
        return { id: playerId, ...payload };
      },
    },
  });
  const params = { playerId: "player-1", registrationId: "insc-1" };

  await controller.findById(createReq({ params }), createRes(200), rethrow);
  await controller.update(createReq({ body: { name: "Ana" }, params }), createRes(200), rethrow);
  await controller.setCaptain(
    createReq({ body: { captain: true }, params }),
    createRes(200),
    rethrow,
  );
  await controller.delete(createReq({ params }), createRes(200), rethrow);

  assert.deepEqual(
    calls.map((call) => call[0]),
    ["findById", "update", "setCaptain", "delete"],
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
