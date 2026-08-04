"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { collectMigrationState } = require("../report-manager");
const { buildValidationReport } = require("../validate-manager");
const { canonicalPlan, doctorReport } = require("./fixtures");

test("validate compara catálogo, ledger e schema físico", () => {
  const report = doctorReport();
  const result = buildValidationReport({
    doctorReport: report,
    canonicalPlan: canonicalPlan(report),
  });
  assert.equal(result.valid, false);
  assert.equal(result.catalog.total, 5);
  assert.equal(result.ledger.exists, false);
  assert.deepEqual(result.physicalSchema.structuralDrift, ["20260103000000_documents"]);
  assert.equal(result.criticalFindings.length, 1);
  assert.equal(result.highFindings.length, 1);
});

test("report manager reutiliza o runner canônico exclusivamente em dry-run", async () => {
  const catalog = [{ id: "20260101000000_sample", dependencies: [] }];
  let receivedDryRun = null;
  let doctorCatalog = null;
  const result = await collectMigrationState({
    reader: { query() {} },
    databaseName: "j12",
    databaseHost: "localhost",
    databaseRemote: false,
    catalogLoader: async () => catalog,
    canonicalRunnerFactory(receivedCatalog) {
      assert.equal(receivedCatalog, catalog);
      return {
        async up(options) {
          receivedDryRun = options.dryRun;
          return { dryRun: true, plan: [{ id: catalog[0].id }] };
        },
      };
    },
    async doctorRunner(options) {
      doctorCatalog = await options.catalogLoader();
      return doctorReport();
    },
  });
  assert.equal(receivedDryRun, true);
  assert.equal(doctorCatalog, catalog);
  assert.equal(result.runner.reused, true);
  assert.equal(result.runner.dryRun, true);
});
