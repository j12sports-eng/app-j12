const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRegistrationController } = require("../controllers/index.js");

test("ChampionshipRegistrationController delegates registration creation to service", async () => {
  const calls = [];
  const controller = new ChampionshipRegistrationController({
    registrationService: {
      async register(payload, context) {
        calls.push({ context, payload });
        return { id: "insc-1", ...payload };
      },
    },
  });
  const response = createResponse();

  await controller.register(
    {
      auth: { email: "admin@j12.test", role: "admin" },
      body: { championshipId: "camp-1", teamId: "team-1" },
    },
    response,
    assert.ifError,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, "insc-1");
  assert.equal(calls[0].context.auth.email, "admin@j12.test");
});

test("ChampionshipRegistrationController delegates list and available teams queries", async () => {
  const calls = [];
  const controller = new ChampionshipRegistrationController({
    registrationService: {
      async findAll(filters) {
        calls.push(["findAll", filters.championshipId]);
        return { items: [], limit: 20, page: 1, total: 0 };
      },
      async findAvailableTeams(filters) {
        calls.push(["findAvailableTeams", filters.championshipId]);
        return { items: [], limit: 20, page: 1, total: 0 };
      },
    },
  });
  const listResponse = createResponse();
  const teamsResponse = createResponse();

  await controller.findAll(
    { params: { championshipId: "camp-1" }, query: { status: "PENDING" } },
    listResponse,
    assert.ifError,
  );
  await controller.findAvailableTeams(
    { query: { championshipId: "camp-1" } },
    teamsResponse,
    assert.ifError,
  );

  assert.equal(listResponse.body.data.total, 0);
  assert.equal(teamsResponse.body.data.total, 0);
  assert.deepEqual(calls, [
    ["findAll", "camp-1"],
    ["findAvailableTeams", "camp-1"],
  ]);
});

test("ChampionshipRegistrationController delegates status update and cancellation", async () => {
  const calls = [];
  const controller = new ChampionshipRegistrationController({
    registrationService: {
      async cancel(id, payload, context) {
        calls.push(["cancel", id, context.auth.email]);
        return { ...payload, id, status: "CANCELLED" };
      },
      async updateStatus(id, payload, context) {
        calls.push(["updateStatus", id, payload.status, context.auth.email]);
        return { id, status: payload.status };
      },
    },
  });
  const request = {
    auth: { email: "admin@j12.test", role: "admin" },
    body: { status: "CONFIRMED" },
    params: { registrationId: "insc-1" },
  };
  const updateResponse = createResponse();
  const cancelResponse = createResponse();

  await controller.updateStatus(request, updateResponse, assert.ifError);
  await controller.cancel(request, cancelResponse, assert.ifError);

  assert.equal(updateResponse.body.data.status, "CONFIRMED");
  assert.equal(cancelResponse.body.data.status, "CANCELLED");
  assert.deepEqual(calls, [
    ["updateStatus", "insc-1", "CONFIRMED", "admin@j12.test"],
    ["cancel", "insc-1", "admin@j12.test"],
  ]);
});

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
