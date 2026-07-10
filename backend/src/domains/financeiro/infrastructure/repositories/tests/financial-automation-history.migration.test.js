const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../../../../../database/migrations/20260709220000_create_financial_automation_execution_history.js");

test("history migration creates an idempotent append-only table definition", () => {
  const sql = migration.buildCreateTableSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS financial_automation_execution_history/);
  assert.match(sql, /PRIMARY KEY \(id\)/);
  assert.doesNotMatch(sql, /UNIQUE[^\n]*execution_id/i);
  assert.match(sql, /input_json LONGTEXT NULL/);
  assert.match(sql, /duration_ms BIGINT UNSIGNED NULL/);
  assert.deepEqual(Object.keys(migration.REQUIRED_COLUMNS).sort(), [
    "attempt",
    "automation_name",
    "correlation_id",
    "created_at",
    "duration_ms",
    "error_json",
    "execution_id",
    "finished_at",
    "id",
    "input_json",
    "metadata_json",
    "output_json",
    "started_at",
    "status",
    "trigger_type",
    "workflow_name",
  ]);
  for (const indexName of Object.keys(migration.INDEXES))
    assert.match(sql, new RegExp(`INDEX ${indexName}`));
});
