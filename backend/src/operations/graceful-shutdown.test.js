const assert = require("node:assert/strict");
const test = require("node:test");
const { createGracefulShutdown } = require("./graceful-shutdown.js");

test("shutdown drains HTTP, socket, jobs and pool once", async () => {
  const calls = [];
  const state = {};
  const shutdown = createGracefulShutdown({
    state,
    server: {
      listening: true,
      close: (done) => {
        calls.push("http");
        done();
      },
      closeIdleConnections: () => calls.push("idle"),
    },
    io: {
      close: (done) => {
        calls.push("io");
        done();
      },
    },
    jobs: [{ stop: async () => calls.push("job") }],
    pool: { end: async () => calls.push("pool") },
    logger: { info() {}, error() {} },
    timeoutMs: 100,
  });
  const first = shutdown("SIGTERM");
  const second = shutdown("SIGINT");
  assert.equal(first, second);
  assert.deepEqual(await first, { completed: true, timedOut: false });
  assert.equal(state.shuttingDown, true);
  assert.deepEqual(calls, ["http", "idle", "io", "job", "pool"]);
});
test("shutdown timeout force-closes connections and reports incomplete", async () => {
  let forced = false;
  const shutdown = createGracefulShutdown({
    server: {
      listening: true,
      close() {},
      closeAllConnections: () => {
        forced = true;
      },
    },
    logger: { info() {}, error() {} },
    timeoutMs: 10,
  });
  assert.deepEqual(await shutdown("SIGTERM"), { completed: false, timedOut: true });
  assert.equal(forced, true);
});
