"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { criticalEnrollmentManifests } = require("../manifests");

test("publica os 23 manifests operacionais com artefatos declarativos", () => {
  assert.equal(criticalEnrollmentManifests.length, 23);
  assert.equal(new Set(criticalEnrollmentManifests.map((item) => item.migrationId)).size, 23);
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
