"use strict";

const { SEVERITIES } = require("../constants");

function checkCatalog(catalog, manifests) {
  const findings = [];
  const names = new Map();
  for (const migration of catalog) {
    const ids = names.get(migration.name) || [];
    ids.push(migration.id);
    names.set(migration.name, ids);
  }
  for (const [name, ids] of names)
    if (ids.length > 1)
      findings.push({
        code: "DUPLICATE_MIGRATION_NAME",
        severity: SEVERITIES.WARNING,
        message: `Nome de migration repetido: ${name}.`,
        details: { name, migrationIds: ids },
      });

  const owners = new Map();
  for (const manifest of manifests)
    for (const expectedTable of manifest.tables || []) {
      for (const [kind, entries] of [
        ["column", expectedTable.columns],
        ["index", expectedTable.indexes],
        ["foreignKey", expectedTable.foreignKeys],
      ]) {
        for (const name of Object.keys(entries || {})) {
          const key = `${expectedTable.name}:${kind}:${name}`;
          const ids = owners.get(key) || [];
          ids.push(manifest.id);
          owners.set(key, ids);
        }
      }
    }
  for (const [artifact, ids] of owners)
    if (ids.length > 1)
      findings.push({
        code: "MANIFEST_ARTIFACT_OVERLAP",
        severity: SEVERITIES.WARNING,
        message: `Artefato declarado por múltiplas migrations: ${artifact}.`,
        details: { artifact, migrationIds: ids },
      });
  return findings;
}

module.exports = { checkCatalog };
