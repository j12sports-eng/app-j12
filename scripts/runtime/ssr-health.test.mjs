import assert from "node:assert/strict";
import test from "node:test";
import { createSsrHealth } from "./ssr-health.mjs";

const now = () => new Date("2026-07-12T12:00:00.000Z");

test("SSR liveness remains healthy independently from build artifacts", () => {
  const health = createSsrHealth({ existsSync: () => false, now });
  assert.equal(health.liveness().statusCode, 200);
});
test("SSR readiness requires client and server artifacts", () => {
  const available = new Set(["client", "server"]);
  const health = createSsrHealth({
    clientDir: "client",
    serverEntry: "server",
    existsSync: (item) => available.has(item),
    now,
  });
  assert.equal(health.readiness().statusCode, 200);
  available.delete("server");
  assert.equal(health.readiness().statusCode, 503);
});
test("SSR readiness becomes unavailable during shutdown", () => {
  const state = { shuttingDown: true };
  const result = createSsrHealth({
    clientDir: "client",
    serverEntry: "server",
    existsSync: () => true,
    state,
    now,
  }).readiness();
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.shuttingDown, true);
});
