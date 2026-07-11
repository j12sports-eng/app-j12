const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const backendRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.resolve(backendRoot, "..");

test("admin state collections require management authorization", () => {
  const source = fs.readFileSync(path.join(backendRoot, "src/routes/state.routes.js"), "utf8");

  assert.match(source, /router\.use\(requireAuth\)/);
  assert.match(source, /canManageSystem\(req\.auth\)/);
  assert.match(source, /status\(403\)/);
});

test("student admin client does not log bearer tokens or full records", () => {
  const source = fs.readFileSync(path.join(projectRoot, "src/lib/alunos-api.ts"), "utf8");

  assert.doesNotMatch(source, /console\.log|TOKEN:/);
});

test("generic admin persistence does not log full snapshots", () => {
  const source = fs.readFileSync(path.join(projectRoot, "src/lib/remote-collection.ts"), "utf8");

  assert.doesNotMatch(source, /console\.(?:log|error)/);
});
