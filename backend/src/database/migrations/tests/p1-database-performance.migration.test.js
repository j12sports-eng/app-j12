const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.resolve(
  __dirname,
  "../20260715223000_add_p1_database_performance_indexes.js",
);
const { INDEXES, assertCompatibleIndex, down } = require(migrationPath);

test("P1 migration import does not load database configuration", () => {
  const script = `
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request.includes('config/db')) throw new Error('database-loaded');
      return original.call(this, request, parent, isMain);
    };
    require(${JSON.stringify(migrationPath)});
  `;
  const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("P1 migration contains only the audited Finance, Agenda and Championship indexes", () => {
  assert.equal(Object.keys(INDEXES).length, 12);
  assert.equal(INDEXES.idx_j12_mensalidades_status_due_id.columns, "status,data_vencimento,id");
  assert.equal(INDEXES.idx_financial_payments_status_created.columns, "status,created_at,id");
  assert.equal(INDEXES.idx_agenda_items_class_schedule.columns, "class_id,day_of_week,start_time");
  assert.equal(
    INDEXES.idx_championship_matches_status_created.columns,
    "championship_id,status,created_at",
  );
});

test("P1 migration validates index order and refuses destructive rollback", async () => {
  assert.doesNotThrow(() =>
    assertCompatibleIndex(
      "idx",
      { NON_UNIQUE: 1, columns: "status,due_date,id" },
      "status,due_date,id",
    ),
  );
  assert.throws(
    () =>
      assertCompatibleIndex(
        "idx",
        { NON_UNIQUE: 1, columns: "due_date,status,id" },
        "status,due_date,id",
      ),
    /Incompatible existing index/,
  );
  await assert.rejects(down(), /Refusing to remove/);
});
