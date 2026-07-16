const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.resolve(
  __dirname,
  "../20260715210000_add_p0_database_performance_indexes.js",
);
const { GENERATED_COLUMNS, INDEXES, REQUIRED_TABLES, assertCompatibleIndex, down } = require(
  migrationPath,
);

test("P0 migration import is deterministic and does not load database configuration", () => {
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

test("P0 migration defines only the audited tables, generated columns and five indexes", () => {
  assert.deepEqual(REQUIRED_TABLES, ["j12_quadra_reservas", "j12_financeiro_cobrancas"]);
  assert.deepEqual(Object.keys(GENERATED_COLUMNS).sort(), [
    "payment_effective_date",
    "status_normalized",
    "type_normalized",
  ]);
  assert.equal(Object.keys(INDEXES).length, 5);
  assert.equal(
    INDEXES.idx_j12_quadra_reservas_availability.columns,
    "quadra_id,status,start_at,end_at",
  );
  assert.equal(INDEXES.idx_j12_cobrancas_active_status_due.columns, "ativo,status,vencimento");
  assert.equal(INDEXES.idx_j12_cobrancas_active_status_paid.columns, "ativo,status,data_pagamento");
});

test("P0 migration validates existing index shape and has fail-closed rollback", async () => {
  assert.doesNotThrow(() =>
    assertCompatibleIndex(
      "idx",
      { NON_UNIQUE: 1, columns: "ativo,status,vencimento" },
      "ativo,status,vencimento",
    ),
  );
  assert.throws(
    () =>
      assertCompatibleIndex(
        "idx",
        { NON_UNIQUE: 1, columns: "status,ativo,vencimento" },
        "ativo,status,vencimento",
      ),
    /Incompatible existing index/,
  );
  await assert.rejects(down(), /Refusing to remove/);
});
