const assert = require("node:assert/strict");
const test = require("node:test");
const { createRuntimeHealth } = require("./runtime-health.js");

const now = () => new Date("2026-07-12T12:00:00.000Z");

test("liveness is independent from database readiness", () => {
  const health = createRuntimeHealth({ state: { database: "error" }, now });
  assert.deepEqual(health.liveness(), {
    statusCode: 200,
    body: { status: "alive", timestamp: "2026-07-12T12:00:00.000Z" },
  });
});
test("readiness returns 200 only when schema and database probe are healthy", async () => {
  const health = createRuntimeHealth({
    state: { database: "ready", schemaReady: true },
    probeDatabase: async () => true,
    now,
  });
  const result = await health.readiness();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, "ready");
});
test("degraded startup returns 503 without exposing internal errors", async () => {
  const state = { database: "error", schemaReady: false, lastError: "secret host stack" };
  const result = await createRuntimeHealth({ state, now }).readiness();
  assert.equal(result.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /secret|stack|host/);
});
test("database probe failure and shutdown make readiness unavailable", async () => {
  const state = { database: "ready", schemaReady: true };
  const health = createRuntimeHealth({
    state,
    probeDatabase: async () => {
      throw new Error("db down");
    },
    now,
  });
  assert.equal((await health.readiness()).statusCode, 503);
  state.shuttingDown = true;
  assert.equal((await createRuntimeHealth({ state, now }).readiness()).statusCode, 503);
});
