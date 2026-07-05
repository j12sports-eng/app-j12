const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipAdminController } = require("../controllers/index.js");

test("ChampionshipAdminController delegates creation to service", async () => {
  const calls = [];
  const controller = new ChampionshipAdminController({
    championshipService: {
      async create(payload, context) {
        calls.push({ context, payload });
        return { id: "camp-1", ...payload };
      },
    },
  });
  const response = createResponse();

  await controller.create(
    {
      auth: { email: "admin@j12.test", role: "admin" },
      body: { name: "Copa J12" },
    },
    response,
    assert.ifError,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, "camp-1");
  assert.equal(calls[0].context.auth.email, "admin@j12.test");
});

test("ChampionshipAdminController delegates publish and archive to service", async () => {
  const calls = [];
  const controller = new ChampionshipAdminController({
    championshipService: {
      async archive(id, context) {
        calls.push(["archive", id, context.auth.email]);
        return { id, status: "ARCHIVED" };
      },
      async publish(id, context) {
        calls.push(["publish", id, context.auth.email]);
        return { id, status: "PUBLISHED" };
      },
    },
  });
  const publishResponse = createResponse();
  const archiveResponse = createResponse();
  const request = {
    auth: { email: "admin@j12.test", role: "admin" },
    params: { id: "camp-1" },
  };

  await controller.publish(request, publishResponse, assert.ifError);
  await controller.archive(request, archiveResponse, assert.ifError);

  assert.equal(publishResponse.body.data.status, "PUBLISHED");
  assert.equal(archiveResponse.body.data.status, "ARCHIVED");
  assert.deepEqual(calls, [
    ["publish", "camp-1", "admin@j12.test"],
    ["archive", "camp-1", "admin@j12.test"],
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
