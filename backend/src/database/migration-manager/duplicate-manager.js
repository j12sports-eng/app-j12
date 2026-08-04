"use strict";

function normalizeMigrationName(migration) {
  return String(migration.name || migration.id || "")
    .replace(/^\d{14}_/, "")
    .replace(/\.(?:js|sql)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function artifactKeys(expectedSchemaEntry) {
  if (!expectedSchemaEntry) return new Set();
  const keys = new Set();
  for (const table of expectedSchemaEntry.requiredTables || []) keys.add(`table:${table}`);
  for (const [kind, artifacts] of [
    ["column", expectedSchemaEntry.requiredColumns],
    ["index", expectedSchemaEntry.requiredIndexes],
    ["foreignKey", expectedSchemaEntry.requiredForeignKeys],
    ["generatedColumn", expectedSchemaEntry.requiredGeneratedColumns],
  ]) {
    for (const artifact of artifacts || []) keys.add(`${kind}:${artifact.table}:${artifact.name}`);
  }
  return keys;
}

function dependsOn(sourceId, targetId, byId, visited = new Set()) {
  if (visited.has(sourceId)) return false;
  visited.add(sourceId);
  const source = byId.get(sourceId);
  for (const dependencyId of source?.dependencies || []) {
    if (dependencyId === targetId || dependsOn(dependencyId, targetId, byId, visited)) return true;
  }
  return false;
}

function analyzeDuplicateMigrations(doctorReport) {
  const migrations = doctorReport.migrations || [];
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const expectedById = new Map(
    (doctorReport.expectedSchema || []).map((entry) => [entry.migrationId, entry]),
  );
  const groups = new Map();
  for (const migration of migrations) {
    const normalizedName = normalizeMigrationName(migration);
    const group = groups.get(normalizedName) || [];
    group.push(migration);
    groups.set(normalizedName, group);
  }

  const diagnostics = [];
  const ambiguousMigrationIds = new Set();
  for (const [normalizedName, group] of groups) {
    if (!normalizedName || group.length < 2) continue;
    const migrationIds = group.map((migration) => migration.id);
    const overlappingArtifacts = [];
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      const leftArtifacts = artifactKeys(expectedById.get(group[leftIndex].id));
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const rightArtifacts = artifactKeys(expectedById.get(group[rightIndex].id));
        for (const artifact of leftArtifacts)
          if (rightArtifacts.has(artifact)) overlappingArtifacts.push(artifact);
      }
    }
    const dependencyRelations = [];
    for (const source of group)
      for (const target of group)
        if (source.id !== target.id && dependsOn(source.id, target.id, byId))
          dependencyRelations.push({ source: source.id, dependsOn: target.id });

    const missingCoverage = group.some((migration) => !migration.manifestAvailable);
    const ambiguousOwnership =
      overlappingArtifacts.length > 0 || dependencyRelations.length > 0 || missingCoverage;
    if (ambiguousOwnership)
      for (const migrationId of migrationIds) ambiguousMigrationIds.add(migrationId);
    diagnostics.push({
      code: "DUPLICATE_MIGRATION_NAME",
      normalizedName,
      migrationIds,
      bothInCatalog: migrationIds.every((migrationId) => byId.has(migrationId)),
      overlappingArtifacts: [...new Set(overlappingArtifacts)],
      dependencyRelations,
      ambiguousOwnership,
      severity: ambiguousOwnership ? "HIGH" : "WARNING",
    });
  }
  return { diagnostics, ambiguousMigrationIds };
}

module.exports = { analyzeDuplicateMigrations, artifactKeys, dependsOn, normalizeMigrationName };
