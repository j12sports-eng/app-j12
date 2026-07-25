import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("digital invitation uses a dedicated read-only client", async () => {
  const client = await read("../api/digital-invitation-public.ts");
  assert.match(client, /digital-invitations\/public/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /cache: "no-store"/);
  assert.doesNotMatch(client, /matricula-api|localStorage|sessionStorage|POST|PUT|PATCH/);
});

test("token route covers safe states and indexing protection", async () => {
  const route = await read("../../../routes/matricula.$token.tsx");
  for (const state of ["loading", "ready", "unavailable", "network", "rate_limit", "malformed"])
    assert.match(route, new RegExp(state));
  assert.match(route, /noindex, nofollow/);
  assert.match(route, /no-referrer/);
  assert.match(route, /disabled/);
});
