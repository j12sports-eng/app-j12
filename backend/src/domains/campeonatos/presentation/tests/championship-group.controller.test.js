const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipGroupController } = require("../controllers/index.js");

test("ChampionshipGroupController delegates create, update and list to service", async () => {
  const calls = [];
  const controller = new ChampionshipGroupController({
    groupService: {
      async create(championshipId, payload, context) {
        calls.push(["create", championshipId, payload.name, context.auth.email]);
        return { championshipId, id: "grupo-1", ...payload };
      },
      async findAll(championshipId, filters) {
        calls.push(["findAll", championshipId, filters.search]);
        return { items: [{ id: "grupo-1" }], limit: 20, page: 1, total: 1 };
      },
      async update(championshipId, groupId, payload, context) {
        calls.push(["update", championshipId, groupId, payload.name, context.auth.email]);
        return { championshipId, id: groupId, ...payload };
      },
    },
  });

  await controller.create(
    createReq({ body: { name: "Grupo A" }, params: { championshipId: "camp-1" } }),
    createRes(201),
    rethrow,
  );
  await controller.findAll(
    createReq({ params: { championshipId: "camp-1" }, query: { search: "grupo" } }),
    createRes(200),
    rethrow,
  );
  await controller.update(
    createReq({
      body: { name: "Grupo Alpha" },
      params: { championshipId: "camp-1", groupId: "grupo-1" },
    }),
    createRes(200),
    rethrow,
  );

  assert.deepEqual(
    calls.map((call) => call[0]),
    ["create", "findAll", "update"],
  );
});

test("ChampionshipGroupController delegates assignment, move, removal and draw", async () => {
  const calls = [];
  const controller = new ChampionshipGroupController({
    groupService: {
      async assignRegistration(championshipId, groupId, payload) {
        calls.push(["assignRegistration", championshipId, groupId, payload.registrationId]);
        return { id: groupId };
      },
      async drawGroups(championshipId, payload) {
        calls.push(["drawGroups", championshipId, payload.groupCount]);
        return { items: [], limit: 100, page: 1, total: 0 };
      },
      async moveRegistration(championshipId, groupId, registrationId, payload) {
        calls.push([
          "moveRegistration",
          championshipId,
          groupId,
          registrationId,
          payload.targetGroupId,
        ]);
        return { id: payload.targetGroupId };
      },
      async redistributeGroups(championshipId, payload) {
        calls.push(["redistributeGroups", championshipId, payload.groupCount]);
        return { items: [], limit: 100, page: 1, total: 0 };
      },
      async remove(championshipId, groupId) {
        calls.push(["remove", championshipId, groupId]);
        return { id: groupId };
      },
      async removeRegistration(championshipId, groupId, registrationId) {
        calls.push(["removeRegistration", championshipId, groupId, registrationId]);
        return { id: groupId };
      },
    },
  });
  const params = { championshipId: "camp-1", groupId: "grupo-1", registrationId: "insc-1" };

  await controller.assignRegistration(
    createReq({ body: { registrationId: "insc-1" }, params }),
    createRes(201),
    rethrow,
  );
  await controller.moveRegistration(
    createReq({ body: { targetGroupId: "grupo-2" }, params }),
    createRes(200),
    rethrow,
  );
  await controller.removeRegistration(createReq({ params }), createRes(200), rethrow);
  await controller.draw(
    createReq({ body: { groupCount: 2 }, params: { championshipId: "camp-1" } }),
    createRes(200),
    rethrow,
  );
  await controller.redistribute(
    createReq({ body: { groupCount: 2 }, params: { championshipId: "camp-1" } }),
    createRes(200),
    rethrow,
  );
  await controller.remove(createReq({ params }), createRes(200), rethrow);

  assert.deepEqual(
    calls.map((call) => call[0]),
    [
      "assignRegistration",
      "moveRegistration",
      "removeRegistration",
      "drawGroups",
      "redistributeGroups",
      "remove",
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
