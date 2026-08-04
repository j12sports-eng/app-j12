"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { DoctorUsageError, assertDatabaseTarget, isLocalHost } = require("../database-target-guard");
const {
  ReadOnlyViolationError,
  assertReadOnlySql,
  createReadOnlyQueryRunner,
} = require("../read-only-query-runner");

test("exige confirmação exata até para banco local", () => {
  assert.throws(
    () =>
      assertDatabaseTarget({
        configuredDatabase: "j12",
        configuredHost: "localhost",
        confirmDatabase: "outro",
        allowRemote: false,
      }),
    DoctorUsageError,
  );
  assert.doesNotThrow(() =>
    assertDatabaseTarget({
      configuredDatabase: "j12",
      configuredHost: "127.0.0.1",
      confirmDatabase: "j12",
      allowRemote: false,
    }),
  );
});

test("exige allow-remote adicional para host remoto", () => {
  assert.equal(isLocalHost("::1"), true);
  assert.throws(
    () =>
      assertDatabaseTarget({
        configuredDatabase: "j12",
        configuredHost: "db.example",
        confirmDatabase: "j12",
        allowRemote: false,
      }),
    /--allow-remote/,
  );
  assert.doesNotThrow(() =>
    assertDatabaseTarget({
      configuredDatabase: "j12",
      configuredHost: "db.example",
      confirmDatabase: "j12",
      allowRemote: true,
    }),
  );
});

test("executor aceita SELECT único e bloqueia escrita, lock e múltiplas instruções", async () => {
  assert.equal(
    assertReadOnlySql("SELECT * FROM INFORMATION_SCHEMA.TABLES"),
    "SELECT * FROM INFORMATION_SCHEMA.TABLES",
  );
  for (const sql of [
    "UPDATE people SET nome = ?",
    "SELECT GET_LOCK(?, ?)",
    "SELECT 1; SELECT 2",
    "CREATE TABLE forbidden (id INT)",
  ]) {
    assert.throws(() => assertReadOnlySql(sql), ReadOnlyViolationError);
  }
  const calls = [];
  const reader = createReadOnlyQueryRunner({
    async query(sql, params) {
      calls.push({ sql, params });
      return [[{ ok: 1 }], []];
    },
  });
  const result = await reader.query("SELECT 1 AS ok", []);
  assert.equal(result[0][0].ok, 1);
  assert.equal(calls.length, 1);
});
