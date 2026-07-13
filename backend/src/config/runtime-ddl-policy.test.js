const assert = require("node:assert/strict");
const test = require("node:test");

const { createRuntimeDdlPolicy } = require("./runtime-ddl-policy.js");

test("production treats CREATE TABLE IF NOT EXISTS as read-only validation when table exists", async () => {
  const inspected = [];
  const policy = createRuntimeDdlPolicy({
    environment: "production",
    async inspectTable(tableName) {
      inspected.push(tableName);
      return true;
    },
  });
  const decision = await policy.beforeExecute(
    "CREATE TABLE IF NOT EXISTS `people` (id VARCHAR(64))",
  );
  assert.deepEqual(inspected, ["people"]);
  assert.equal(decision.execute, false);
  assert.equal(decision.tableName, "people");
});

test("production fails clearly when a required table is absent", async () => {
  const policy = createRuntimeDdlPolicy({
    environment: "production",
    async inspectTable() {
      return false;
    },
  });
  await assert.rejects(
    () => policy.beforeExecute("CREATE TABLE IF NOT EXISTS people (id VARCHAR(64))"),
    (error) => error.code === "PRODUCTION_SCHEMA_TABLE_MISSING" && error.objectName === "people",
  );
});

test("production blocks ALTER, CREATE INDEX and generic runtime DDL without executing it", async () => {
  const policy = createRuntimeDdlPolicy({
    environment: "production",
    async inspectTable() {
      return true;
    },
  });
  for (const sql of [
    "ALTER TABLE people ADD email VARCHAR(191)",
    "CREATE INDEX idx_people ON people (id)",
    "TRUNCATE TABLE people",
  ]) {
    await assert.rejects(
      () => policy.beforeExecute(sql),
      (error) => error.code === "PRODUCTION_RUNTIME_DDL_BLOCKED",
    );
  }
});

test("development preserves existing runtime compatibility", async () => {
  const policy = createRuntimeDdlPolicy({
    environment: "development",
    async inspectTable() {
      throw new Error("must not inspect");
    },
  });
  assert.deepEqual(await policy.beforeExecute("ALTER TABLE people ADD email VARCHAR(191)"), {
    execute: true,
  });
});

test("only the explicit migration-runner context may execute production DDL", async () => {
  const policy = createRuntimeDdlPolicy({ environment: "production", migrationContext: "true" });
  assert.deepEqual(await policy.beforeExecute("DROP TABLE people"), { execute: true });
});
