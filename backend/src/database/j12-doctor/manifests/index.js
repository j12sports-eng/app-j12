"use strict";

const { criticalEnrollmentManifests } = require("./critical-enrollment.manifests");
const { draftChainManifests } = require("./draft-chain.manifests");

const draftIds = new Set(draftChainManifests.map((manifest) => manifest.migrationId));
const operationalManifests = Object.freeze([
  ...criticalEnrollmentManifests.filter((manifest) => !draftIds.has(manifest.migrationId)),
  ...draftChainManifests,
]);

function manifestMap(manifests = operationalManifests) {
  return new Map(manifests.map((manifest) => [manifest.migrationId || manifest.id, manifest]));
}

module.exports = {
  criticalEnrollmentManifests: operationalManifests,
  draftChainManifests,
  manifestMap,
  operationalManifests,
};
