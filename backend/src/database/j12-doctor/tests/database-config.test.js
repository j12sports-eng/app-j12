"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { databaseConfigFromEnv, parseDatabaseUrl } = require("../database-client");

test("interpreta DATABASE_URL sem expor credenciais e respeita overrides DB_*", () => {
  const parsed = parseDatabaseUrl("mysql://user:p%40ss@db.example:3307/j12");
  assert.deepEqual(parsed, {
    host: "db.example",
    port: 3307,
    user: "user",
    password: "p@ss",
    database: "j12",
  });
  const config = databaseConfigFromEnv({
    DATABASE_URL: "mysql://user:secret@db.example:3307/j12",
    DB_HOST: "localhost",
    DB_NAME: "j12_local",
  });
  assert.equal(config.host, "localhost");
  assert.equal(config.database, "j12_local");
  assert.equal(config.user, "user");
});
