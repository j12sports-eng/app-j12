"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { analyzeDuplicateMigrations } = require("../duplicate-manager");

test("diagnóstico de duplicidade informa overlap, dependência e presença no catálogo", () => {
  const firstId = "20260701103000_add_enrollment_class_links_table";
  const secondId = "20260701120000_add_enrollment_class_links_table";
  const artifact = {
    table: "enrollment_class_links",
    name: "ux_enrollment_class",
    columns: ["enrollment_id", "class_id"],
    unique: true,
  };
  const result = analyzeDuplicateMigrations({
    migrations: [
      {
        id: firstId,
        name: "add_enrollment_class_links_table",
        dependencies: [],
        manifestAvailable: true,
      },
      {
        id: secondId,
        name: "add_enrollment_class_links_table",
        dependencies: [firstId],
        manifestAvailable: true,
      },
    ],
    expectedSchema: [
      { migrationId: firstId, requiredTables: [], requiredIndexes: [artifact] },
      { migrationId: secondId, requiredTables: [], requiredIndexes: [artifact] },
    ],
  });
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.normalizedName, "add_enrollment_class_links_table");
  assert.equal(diagnostic.bothInCatalog, true);
  assert.deepEqual(diagnostic.overlappingArtifacts, [
    "index:enrollment_class_links:ux_enrollment_class",
  ]);
  assert.deepEqual(diagnostic.dependencyRelations, [{ source: secondId, dependsOn: firstId }]);
  assert.equal(diagnostic.severity, "HIGH");
  assert.equal(diagnostic.ambiguousOwnership, true);
});
