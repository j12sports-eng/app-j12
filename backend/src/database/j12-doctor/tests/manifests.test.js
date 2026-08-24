"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { criticalEnrollmentManifests } = require("../manifests");

test("publica os 24 manifests operacionais com artefatos declarativos", () => {
  assert.equal(criticalEnrollmentManifests.length, 24);
  assert.equal(new Set(criticalEnrollmentManifests.map((item) => item.migrationId)).size, 24);
  assert.ok(
    criticalEnrollmentManifests.some(
      (manifest) => manifest.migrationId === "20260713100000_create_classes_foundation_table",
    ),
  );
  for (const manifest of criticalEnrollmentManifests) {
    assert.match(manifest.migrationId, /^\d{14}_[a-z0-9_]+$/);
    assert.ok(Array.isArray(manifest.requiredTables));
    assert.ok(Array.isArray(manifest.requiredColumns));
    assert.ok(Array.isArray(manifest.requiredIndexes));
    assert.ok(Array.isArray(manifest.requiredForeignKeys));
    assert.ok(Array.isArray(manifest.requiredGeneratedColumns));
    assert.ok(Array.isArray(manifest.optionalArtifacts));
  }
});
