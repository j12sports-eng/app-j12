"use strict";

const { createHash } = require("node:crypto");

const TOKEN_VERSION = "J12_BASELINE_V1";

function buildBaselineTokenPayload(databaseName, migrations) {
  return {
    version: TOKEN_VERSION,
    databaseName: String(databaseName || ""),
    count: migrations.length,
    migrations: migrations.map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
    })),
  };
}

function computeBaselineToken(databaseName, migrations) {
  const payload = buildBaselineTokenPayload(databaseName, migrations);
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

module.exports = { TOKEN_VERSION, buildBaselineTokenPayload, computeBaselineToken };
