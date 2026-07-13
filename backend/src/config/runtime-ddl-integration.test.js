const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..", "..");

test("database adapter guards pool query, execute and acquired connections", async () => {
  const source = await read("backend/src/config/db.js");
  assert.match(source, /pool\.execute = .*executeWithRuntimeDdlPolicy/);
  assert.match(source, /pool\.query = .*executeWithRuntimeDdlPolicy/);
  assert.match(source, /pool\.getConnection = async .*guardConnectionDdl/);
  assert.match(source, /connection\.execute = .*executeWithRuntimeDdlPolicy/);
  assert.match(source, /connection\.query = .*executeWithRuntimeDdlPolicy/);
});

test("both server entrypoints stop accepting traffic after production bootstrap failure", async () => {
  const [canonical, legacy] = await Promise.all([
    read("server/index.mjs"),
    read("backend/src/server.js"),
  ]);
  assert.match(
    canonical,
    /NODE_ENV === "production"[\s\S]*process\.exitCode = 1;[\s\S]*server\.close\(\)/,
  );
  assert.match(
    legacy,
    /NODE_ENV \|\| ""[\s\S]*=== "production"[\s\S]*process\.exitCode = 1;[\s\S]*server\.close\(\)/,
  );
});

test("Pessoas runtime SQL has a formal canonical migration without destructive DOWN", async () => {
  const migration = await read(
    "backend/src/database/migrations/20260712183000_create_people_domain_tables.sql",
  );
  for (const table of ["people", "person_profiles", "person_relationships", "pre_matriculas"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  const down = migration.split(/-- DOWN/i)[1] || "";
  assert.doesNotMatch(down, /DROP\s+TABLE/i);
});

test("canonical runner is the only explicit production DDL opt-in", async () => {
  const [cli, database] = await Promise.all([
    read("backend/src/database/migration-runner/cli.js"),
    read("backend/src/config/db.js"),
  ]);
  assert.match(cli, /J12_MIGRATION_RUNNER_CONTEXT = "true"/);
  assert.match(database, /migrationContext: process\.env\.J12_MIGRATION_RUNNER_CONTEXT/);
  assert.doesNotMatch(await read("server/index.mjs"), /J12_MIGRATION_RUNNER_CONTEXT/);
  assert.doesNotMatch(await read("backend/src/server.js"), /J12_MIGRATION_RUNNER_CONTEXT/);
});

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}
