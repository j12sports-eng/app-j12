const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../../../../..");

function source(relativePath) {
  return readFileSync(path.resolve(repositoryRoot, relativePath), "utf8");
}

test("j12_unidades is the only unit entity used by the mounted unit catalog", () => {
  const serverSource = source("backend/src/server.js");
  const routeSource = source("backend/src/routes/unidades.routes.js");
  const publicCatalogSource = source("backend/src/controllers/public-catalog.controller.js");

  assert.match(serverSource, /mount\(\["\/unidades", "\/api\/unidades"\], unidadesRoutes\)/u);
  assert.match(routeSource, /\bj12_unidades\b/u);
  assert.match(publicCatalogSource, /\bj12_unidades\b/u);
  assert.doesNotMatch(routeSource, /\b(?:FROM|JOIN|INTO|UPDATE)\s+`?unidades`?\b/iu);
  assert.doesNotMatch(publicCatalogSource, /\b(?:FROM|JOIN)\s+`?unidades`?\b/iu);
});

test("the authentication contract still has two independent persistent identity namespaces", () => {
  const authSource = source("backend/auth.js");
  const authSchema = source(
    "backend/src/database/migrations/20260712184500_create_auth_runtime_tables.sql",
  );

  assert.match(authSchema, /CREATE TABLE IF NOT EXISTS j12_usuarios/u);
  assert.match(authSchema, /CREATE TABLE IF NOT EXISTS users/u);
  assert.match(authSource, /source:\s*"j12_usuarios"/u);
  assert.match(authSource, /source:\s*"users"/u);
  assert.match(authSource, /sub:\s*user\.id/u);
  assert.match(authSource, /source:\s*user\.source\s*\|\|\s*"users"/u);
  assert.match(authSource, /payload\?\.source\s*===\s*"j12_usuarios"/u);
});

test("membership persistence is not fabricated while canonical user identity is unresolved", () => {
  const migrationsDirectory = path.resolve(repositoryRoot, "backend/src/database/migrations");
  const migrationNames = readdirSync(migrationsDirectory).filter((name) =>
    /^\d{14}_.+\.(?:js|sql)$/u.test(name),
  );
  const serverSource = source("backend/src/server.js");

  assert.deepEqual(
    migrationNames.filter((name) => /user[_-]unit|unit[_-]user|membership/iu.test(name)),
    [],
  );
  assert.doesNotMatch(serverSource, /pre-enrollment-internal\.routes/u);
  assert.doesNotMatch(serverSource, /createPreEnrollmentInternalRouter/u);
});
