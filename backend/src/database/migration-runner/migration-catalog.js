const { createHash } = require("node:crypto");
const { promises: fs } = require("node:fs");
const path = require("node:path");

const { MIGRATION_DEPENDENCIES } = require("./migration-dependencies.js");

const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.(js|sql)$/;

async function discoverMigrationCatalog({ directory = defaultMigrationsDirectory() } = {}) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !MIGRATION_FILE_PATTERN.test(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    files.push({
      content: await fs.readFile(absolutePath),
      fileName: entry.name,
      path: absolutePath,
    });
  }

  return buildMigrationCatalog(files, { dependencies: MIGRATION_DEPENDENCIES });
}

function buildMigrationCatalog(files = [], { dependencies = {} } = {}) {
  if (!Array.isArray(files)) throw new TypeError("Migration catalog requires a file array.");

  const migrations = files.map((file) => {
    const fileName = String(file?.fileName || "").trim();
    const match = MIGRATION_FILE_PATTERN.exec(fileName);

    if (!match)
      throw migrationError(
        `Invalid migration filename: ${fileName || "<empty>"}.`,
        "MIGRATION_FILENAME_INVALID",
      );

    const content = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(String(file.content ?? ""), "utf8");
    if (content.length === 0)
      throw migrationError(`Migration ${fileName} is empty.`, "MIGRATION_EMPTY");

    return Object.freeze({
      checksum: createHash("sha256").update(content).digest("hex"),
      extension: match[3],
      fileName,
      id: `${match[1]}_${match[2]}`,
      name: match[2],
      path: file.path || fileName,
      timestamp: match[1],
    });
  });

  migrations.sort((left, right) => left.id.localeCompare(right.id));
  assertUnique(migrations, "id", "MIGRATION_ID_DUPLICATE");
  assertUnique(migrations, "timestamp", "MIGRATION_TIMESTAMP_DUPLICATE");
  return orderByDependencies(migrations, dependencies);
}

function orderByDependencies(migrations, dependencies = {}) {
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const migrationId of Object.keys(dependencies)) {
    if (!byId.has(migrationId))
      throw migrationError(
        `Dependency declaration references unknown migration ${migrationId}.`,
        "MIGRATION_DEPENDENCY_DECLARATION_UNKNOWN",
        { migrationId },
      );
  }

  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(migration) {
    if (visited.has(migration.id)) return;
    if (visiting.has(migration.id))
      throw migrationError(
        `Migration dependency cycle at ${migration.id}.`,
        "MIGRATION_DEPENDENCY_CYCLE",
        { migrationId: migration.id },
      );
    visiting.add(migration.id);
    const migrationDependencies = dependencies[migration.id] || [];
    for (const dependencyId of migrationDependencies) {
      const dependency = byId.get(dependencyId);
      if (!dependency)
        throw migrationError(
          `Migration ${migration.id} requires missing migration ${dependencyId}.`,
          "MIGRATION_DEPENDENCY_MISSING",
          { dependencyId, migrationId: migration.id },
        );
      visit(dependency);
    }
    visiting.delete(migration.id);
    visited.add(migration.id);
    ordered.push(
      Object.freeze({
        ...migration,
        dependencies: Object.freeze([...migrationDependencies]),
      }),
    );
  }

  migrations.forEach(visit);
  return Object.freeze(ordered);
}

function assertUnique(migrations, field, code) {
  const seen = new Set();
  for (const migration of migrations) {
    if (seen.has(migration[field])) {
      throw migrationError(`Duplicate migration ${field}: ${migration[field]}.`, code, {
        [field]: migration[field],
      });
    }
    seen.add(migration[field]);
  }
}

function defaultMigrationsDirectory() {
  return path.resolve(__dirname, "..", "migrations");
}

function migrationError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

module.exports = {
  MIGRATION_FILE_PATTERN,
  buildMigrationCatalog,
  defaultMigrationsDirectory,
  discoverMigrationCatalog,
  migrationError,
  orderByDependencies,
};
