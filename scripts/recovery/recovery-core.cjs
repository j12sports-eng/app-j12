const { createHash } = require("node:crypto");
const { createReadStream, createWriteStream, promises: fs } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { createGunzip, createGzip } = require("node:zlib");

const ARTIFACT_PATTERN = /^j12-backup-(\d{8}T\d{6}Z)\.sql\.gz$/;
const DEFAULT_REQUIRED_TABLES = Object.freeze([
  "enrollments",
  "j12_alunos",
  "j12_financeiro_cobrancas",
  "j12_mensalidades",
  "j12_pagamentos",
  "users",
]);

function assertDefaultsFile(filePath) {
  const normalized = requiredText(filePath, "defaultsFile");
  if (!path.isAbsolute(normalized))
    throw recoveryError(
      "MySQL defaults file must use an absolute path.",
      "RECOVERY_DEFAULTS_PATH_NOT_ABSOLUTE",
    );
  return normalized;
}

function assertOutputDirectory(directory, { repositoryRoot = process.cwd() } = {}) {
  const normalized = path.resolve(requiredText(directory, "outputDirectory"));
  const root = path.resolve(repositoryRoot);
  if (isInside(normalized, root))
    throw recoveryError(
      "Backup output must be outside the Git workspace.",
      "RECOVERY_OUTPUT_INSIDE_REPOSITORY",
    );
  return normalized;
}

function assertDisposableDatabase(database, confirmation) {
  const normalized = requiredText(database, "database");
  if (!/(?:^|_)(?:restore|scratch|disposable|test)(?:_|$)/i.test(normalized)) {
    throw recoveryError(
      "Restore target name must explicitly identify a disposable database.",
      "RECOVERY_TARGET_NOT_DISPOSABLE",
    );
  }
  if (requiredText(confirmation, "confirmation") !== normalized) {
    throw recoveryError(
      "Disposable restore confirmation must exactly match the database name.",
      "RECOVERY_TARGET_CONFIRMATION_MISMATCH",
    );
  }
  return normalized;
}

async function createBackup({
  database,
  defaultsFile,
  outputDirectory,
  repositoryRoot,
  processFactory = spawn,
  now = () => new Date(),
  gitSha = null,
  storageEncrypted = false,
} = {}) {
  const dbName = requiredText(database, "database");
  const defaults = assertDefaultsFile(defaultsFile);
  const output = assertOutputDirectory(outputDirectory, { repositoryRoot });
  if (!storageEncrypted)
    throw recoveryError(
      "Encrypted storage acknowledgement is required.",
      "RECOVERY_ENCRYPTED_STORAGE_REQUIRED",
    );
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  const stamp = formatUtcStamp(now());
  const artifactPath = path.join(output, `j12-backup-${stamp}.sql.gz`);
  const manifestPath = `${artifactPath}.manifest.json`;
  const child = processFactory(
    "mysqldump",
    [
      `--defaults-extra-file=${defaults}`,
      "--single-transaction",
      "--quick",
      "--routines",
      "--triggers",
      "--events",
      "--hex-blob",
      "--set-gtid-purged=OFF",
      dbName,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const stderr = collectSafeStderr(child.stderr);
  await Promise.all([
    pipeline(
      child.stdout,
      createGzip({ level: 9 }),
      createWriteStream(artifactPath, { mode: 0o600 }),
    ),
    waitForChild(child, "mysqldump", stderr),
  ]).catch(async (error) => {
    await fs.rm(artifactPath, { force: true });
    throw error;
  });

  const validation = await validateArtifact({ artifactPath });
  const manifest = {
    artifact: path.basename(artifactPath),
    bytes: validation.bytes,
    createdAt: now().toISOString(),
    database: dbName,
    dumpFormat: "mysql-logical-sql-gzip",
    gitSha: nullableText(gitSha),
    requiredTables: DEFAULT_REQUIRED_TABLES,
    schemaTables: validation.schemaTables,
    sha256: validation.sha256,
    storageEncryption: "operator-confirmed",
    version: 1,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { artifactPath, manifest, manifestPath };
}

async function validateArtifact({
  artifactPath,
  manifestPath = `${artifactPath}.manifest.json`,
} = {}) {
  const artifact = path.resolve(requiredText(artifactPath, "artifactPath"));
  const stat = await fs.stat(artifact);
  if (!stat.isFile() || stat.size === 0)
    throw recoveryError("Backup artifact is empty or invalid.", "RECOVERY_ARTIFACT_INVALID");
  const [sha256, sql] = await Promise.all([sha256File(artifact), readGzipText(artifact)]);
  if (!/MySQL|MariaDB|CREATE TABLE|INSERT INTO/i.test(sql))
    throw recoveryError(
      "Gzip is valid but does not look like a MySQL logical dump.",
      "RECOVERY_DUMP_CONTENT_INVALID",
    );
  const schemaTables = [
    ...sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([a-zA-Z0-9_]+)`?/gi),
  ]
    .map((match) => match[1])
    .sort();
  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (manifest?.sha256 && manifest.sha256 !== sha256)
    throw recoveryError("Backup checksum differs from its manifest.", "RECOVERY_CHECKSUM_MISMATCH");
  return { bytes: stat.size, manifest, schemaTables: [...new Set(schemaTables)], sha256 };
}

async function restoreArtifact({
  artifactPath,
  database,
  defaultsFile,
  confirmation,
  processFactory = spawn,
} = {}) {
  const dbName = assertDisposableDatabase(database, confirmation);
  const defaults = assertDefaultsFile(defaultsFile);
  await validateArtifact({ artifactPath });
  const child = processFactory(
    "mysql",
    [`--defaults-extra-file=${defaults}`, "--binary-mode", dbName],
    {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const stderr = collectSafeStderr(child.stderr);
  await Promise.all([
    pipeline(createReadStream(artifactPath), createGunzip(), child.stdin),
    waitForChild(child, "mysql restore", stderr),
  ]);
  return { database: dbName, restored: true };
}

async function verifyRestoredDatabase({
  database,
  defaultsFile,
  confirmation,
  processFactory = spawn,
  requiredTables = DEFAULT_REQUIRED_TABLES,
} = {}) {
  const dbName = assertDisposableDatabase(database, confirmation);
  const defaults = assertDefaultsFile(defaultsFile);
  const tableRows = await runMysqlQuery({
    database: dbName,
    defaultsFile: defaults,
    processFactory,
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name",
  });
  const tables = new Set(tableRows);
  const missingTables = requiredTables.filter((table) => !tables.has(table));
  if (missingTables.length > 0)
    throw recoveryError(
      `Restored schema is missing required tables: ${missingTables.join(", ")}.`,
      "RECOVERY_REQUIRED_TABLES_MISSING",
      { missingTables },
    );
  const check = processFactory(
    "mysqlcheck",
    [`--defaults-extra-file=${defaults}`, "--check", dbName],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const stderr = collectSafeStderr(check.stderr);
  await waitForChild(check, "mysqlcheck", stderr);
  return { database: dbName, integrityCheck: "passed", tableCount: tables.size };
}

async function runPostRestoreSmoke({
  database,
  defaultsFile,
  confirmation,
  processFactory = spawn,
} = {}) {
  const dbName = assertDisposableDatabase(database, confirmation);
  const defaults = assertDefaultsFile(defaultsFile);
  const rows = await runMysqlQuery({
    database: dbName,
    defaultsFile: defaults,
    processFactory,
    sql: "SELECT CONCAT('tables=', COUNT(*)) FROM information_schema.tables WHERE table_schema = DATABASE() UNION ALL SELECT CONCAT('ledger=', COUNT(*)) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'j12_schema_migrations'",
  });
  if (!rows.some((row) => /^tables=[1-9]\d*$/.test(row)))
    throw recoveryError("Post-restore smoke found no tables.", "RECOVERY_SMOKE_FAILED");
  return { checks: rows, database: dbName, smoke: "passed" };
}

async function applyRetention({
  apply = false,
  keepDays = 30,
  now = () => new Date(),
  outputDirectory,
  repositoryRoot,
} = {}) {
  const output = assertOutputDirectory(outputDirectory, { repositoryRoot });
  const days = Number(keepDays);
  if (!Number.isInteger(days) || days < 1 || days > 3650)
    throw recoveryError("Retention days must be between 1 and 3650.", "RECOVERY_RETENTION_INVALID");
  const threshold = now().getTime() - days * 86400000;
  const removed = [];
  for (const entry of await fs.readdir(output, { withFileTypes: true })) {
    const match = ARTIFACT_PATTERN.exec(entry.name);
    if (!entry.isFile() || !match) continue;
    const createdAt = parseUtcStamp(match[1]);
    if (createdAt.getTime() >= threshold) continue;
    const artifact = path.join(output, entry.name);
    const related = [artifact, `${artifact}.manifest.json`];
    removed.push(...related.map((item) => path.basename(item)));
    if (apply) for (const item of related) await fs.rm(item, { force: true });
  }
  return { applied: apply, candidates: removed.sort(), keepDays: days };
}

async function runMysqlQuery({ database, defaultsFile, processFactory, sql }) {
  const child = processFactory(
    "mysql",
    [
      `--defaults-extra-file=${defaultsFile}`,
      "--batch",
      "--skip-column-names",
      database,
      "--execute",
      sql,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const stderr = collectSafeStderr(child.stderr);
  const stdout = collectText(child.stdout, 1024 * 1024);
  await waitForChild(child, "mysql query", stderr);
  return (await stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function waitForChild(child, operation, stderrPromise) {
  return new Promise((resolve, reject) => {
    child.once("error", (error) =>
      reject(
        recoveryError(
          `${operation} could not start: ${error.code || "unknown error"}.`,
          "RECOVERY_TOOL_START_FAILED",
        ),
      ),
    );
    child.once("close", async (code) => {
      if (code === 0) return resolve();
      const stderr = await stderrPromise;
      reject(
        recoveryError(
          `${operation} failed with exit code ${code}${stderr ? `: ${stderr}` : ""}.`,
          "RECOVERY_TOOL_FAILED",
          { exitCode: code },
        ),
      );
    });
  });
}

function collectSafeStderr(stream) {
  return collectText(stream, 4000).then((value) => sanitizeLog(value));
}
function collectText(stream, limit) {
  if (!stream) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    let value = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      if (value.length < limit) value += chunk.slice(0, limit - value.length);
    });
    stream.once("end", () => resolve(value));
    stream.once("error", reject);
  });
}

function sanitizeLog(value) {
  return String(value || "")
    .replace(/(--password(?:=|\s+)\S+|password\s*[=:]\s*\S+)/gi, "[REDACTED]")
    .replace(/(mysql:\/\/)[^\s@]+@/gi, "$1[REDACTED]@")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 1000);
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function readGzipText(filePath) {
  const chunks = [];
  const collector = new (require("node:stream").Writable)({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await pipeline(createReadStream(filePath), createGunzip(), collector);
  return Buffer.concat(chunks).toString("utf8");
}

function formatUtcStamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
function parseUtcStamp(value) {
  return new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`,
  );
}
function isInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function requiredText(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized)
    throw recoveryError(`Recovery requires ${field}.`, "RECOVERY_INPUT_REQUIRED", { field });
  return normalized;
}
function nullableText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}
function recoveryError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

module.exports = {
  ARTIFACT_PATTERN,
  DEFAULT_REQUIRED_TABLES,
  applyRetention,
  assertDefaultsFile,
  assertDisposableDatabase,
  assertOutputDirectory,
  createBackup,
  formatUtcStamp,
  restoreArtifact,
  runPostRestoreSmoke,
  sanitizeLog,
  sha256File,
  validateArtifact,
  verifyRestoredDatabase,
};
