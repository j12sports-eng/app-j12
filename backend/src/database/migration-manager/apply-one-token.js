"use strict";

const { createHash } = require("node:crypto");

const APPLY_ONE_TOKEN_VERSION = "J12_APPLY_ONE_V1";

function buildApplyOneTokenPayload({
  databaseName,
  migration,
  dependencies,
  planSnapshot,
  operationalPreflight = null,
}) {
  return {
    version: APPLY_ONE_TOKEN_VERSION,
    databaseName: String(databaseName || ""),
    migration: {
      id: migration.id,
      checksum: migration.checksum,
    },
    dependencies: dependencies.map((dependency) => ({
      id: dependency.id,
      checksum: dependency.checksum,
      ledgerState: dependency.ledgerState,
    })),
    planSnapshot: planSnapshot.map((entry) => ({
      id: entry.id,
      checksum: entry.checksum,
      ledgerState: entry.ledgerState,
      physicalState: entry.physicalState,
    })),
    operationalPreflight,
  };
}

function computeApplyOneToken(input) {
  return createHash("sha256")
    .update(JSON.stringify(buildApplyOneTokenPayload(input)), "utf8")
    .digest("hex");
}

module.exports = {
  APPLY_ONE_TOKEN_VERSION,
  buildApplyOneTokenPayload,
  computeApplyOneToken,
};
