const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const read = (file) => readFile(path.join(ROOT, file), "utf8");

test("canonical API exposes separate live and ready routes with health compatibility", async () => {
  const source = await read("backend/src/server.js");
  assert.match(source, /\["\/live", "\/api\/live"\]/);
  assert.match(source, /"\/ready", "\/api\/ready", "\/health", "\/api\/health"/);
  assert.match(source, /pool\.query\("SELECT 1"\)/);
  assert.doesNotMatch(source, /lastError:[\s\S]{0,200}res\.status/);
});

test("Nginx external health proxies API readiness and exposes SSR health", async () => {
  for (const file of [
    "deploy/nginx/app.j12sports.com.br.conf",
    "deploy/nginx/hml.app.j12sports.com.br.conf",
  ]) {
    const source = await read(file);
    assert.match(source, /location = \/health[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:3001\/ready/);
    assert.match(
      source,
      /location = \/ssr\/health[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:4173\/ready/,
    );
    assert.doesNotMatch(source, /return 200 "ok/);
  }
});

test("API and SSR register one-shot SIGTERM and SIGINT graceful shutdown", async () => {
  const api = await read("backend/src/server.js");
  const ssr = await read("scripts/serve-ssr.mjs");
  for (const source of [api, ssr]) {
    assert.match(source, /process\.once\("SIGTERM"/);
    assert.match(source, /process\.once\("SIGINT"/);
    assert.match(source, /createGracefulShutdown/);
  }
  assert.match(api, /pool,/);
  assert.match(api, /stopDatabaseJobs/);
});
