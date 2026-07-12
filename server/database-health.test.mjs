import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseHealthController } from "./database-health.mjs";

test("health aplica cooldown, mantem indisponibilidade e tenta novamente depois", async () => {
  let now = 1000;
  let probes = 0;
  const state = { ok: false };
  const outcomes = [false, true];
  const controller = createDatabaseHealthController({
    state,
    now: () => now,
    cooldownMs: 30000,
    probe: async () => {
      probes += 1;
      state.ok = outcomes.shift();
      return state.ok;
    },
  });

  assert.equal(await controller.refreshForHealth(), false);
  assert.equal(probes, 1);
  assert.equal(state.ok, false);

  now += 29999;
  assert.equal(await controller.refreshForHealth(), false);
  assert.equal(probes, 1);
  assert.equal(state.ok ? 200 : 503, 503);

  now += 1;
  assert.equal(await controller.refreshForHealth(), true);
  assert.equal(probes, 2);
  assert.equal(state.ok ? 200 : 503, 200);
});

test("health compartilha probe concorrente", async () => {
  let probes = 0;
  let finish;
  const state = { ok: false };
  const controller = createDatabaseHealthController({
    state,
    probe: () => {
      probes += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const first = controller.refreshForHealth();
  const second = controller.refreshForHealth();
  assert.equal(first, second);
  await Promise.resolve();
  finish(false);
  await Promise.all([first, second]);
  assert.equal(probes, 1);
});

test("cooldown possui default e minimo defensivos", async () => {
  let now = 0;
  let probes = 0;
  const state = { ok: false };
  const controller = createDatabaseHealthController({
    state,
    now: () => now,
    cooldownMs: 1,
    probe: async () => {
      probes += 1;
      return false;
    },
  });
  await controller.refreshForHealth();
  now = 4999;
  await controller.refreshForHealth();
  assert.equal(probes, 1);
  now = 5000;
  await controller.refreshForHealth();
  assert.equal(probes, 2);
});
