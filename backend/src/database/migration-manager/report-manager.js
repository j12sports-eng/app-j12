"use strict";

const { runDoctor } = require("../j12-doctor/doctor");
const { CanonicalMigrationRunner } = require("../migration-runner/canonical-migration-runner");
const { discoverMigrationCatalog } = require("../migration-runner/migration-catalog");

async function collectMigrationState({
  reader,
  databaseName,
  databaseHost,
  databaseRemote,
  catalogLoader = discoverMigrationCatalog,
  doctorRunner = runDoctor,
  canonicalRunnerFactory = (catalog) => new CanonicalMigrationRunner({ catalog }),
}) {
  const catalog = await catalogLoader();
  const canonicalDryRun = await canonicalRunnerFactory(catalog).up({ dryRun: true });
  const doctorReport = await doctorRunner({
    reader,
    databaseName,
    databaseHost,
    databaseRemote,
    catalogLoader: async () => catalog,
  });
  return {
    doctorReport,
    canonicalPlan: canonicalDryRun.plan,
    runner: {
      reused: true,
      dryRun: canonicalDryRun.dryRun === true,
      migrations: canonicalDryRun.plan.length,
    },
  };
}

module.exports = { collectMigrationState };
