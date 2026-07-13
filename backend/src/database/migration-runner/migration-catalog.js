const { createHash } = require("node:crypto");
const { promises: fs } = require("node:fs");
const path = require("node:path");

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

  return buildMigrationCatalog(files);
}

function buildMigrationCatalog(files = []) {
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
  return Object.freeze(migrations);
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
};
