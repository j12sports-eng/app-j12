const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { promises: fs } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough, Readable } = require("node:stream");
const test = require("node:test");
const { gzip } = require("node:zlib");
const { promisify } = require("node:util");

const {
  applyRetention,
  assertDisposableDatabase,
  assertOutputDirectory,
  createBackup,
  restoreArtifact,
  runPostRestoreSmoke,
  sanitizeLog,
  sha256File,
  validateArtifact,
  verifyRestoredDatabase,
} = require("./recovery-core.cjs");

const gzipAsync = promisify(gzip);

test("backup uses defaults file, compressed artifact, checksum manifest and no password argument", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "j12-backup-test-"));
  const calls = [];
  const result = await createBackup({
    database: "j12_synthetic",
    defaultsFile: path.join(output, "backup.cnf"),
    gitSha: "abc123",
    now: sequenceDates("2026-07-12T18:00:00.000Z", "2026-07-12T18:00:01.000Z"),
    outputDirectory: output,
    processFactory: fakeProcessFactory(calls, {
      mysqldump: "-- MySQL dump\nCREATE TABLE `users` (id INT);\n",
    }),
    repositoryRoot: path.join(output, "not-the-repository"),
    storageEncrypted: true,
  });
  assert.equal(calls[0].command, "mysqldump");
  assert.equal(
    calls[0].args.some((argument) => /password/i.test(argument)),
    false,
  );
  assert.equal(
    calls[0].args.some((argument) => argument.includes("--defaults-extra-file=")),
    true,
  );
  assert.equal(result.manifest.sha256, await sha256File(result.artifactPath));
  assert.deepEqual(result.manifest.schemaTables, ["users"]);
  assert.equal(result.manifest.storageEncryption, "operator-confirmed");
});

test("backup refuses output inside repository and missing encrypted storage acknowledgement", async () => {
  assert.throws(
    () => assertOutputDirectory(path.join(process.cwd(), "backups")),
    (error) => error.code === "RECOVERY_OUTPUT_INSIDE_REPOSITORY",
  );
  await assert.rejects(
    () =>
      createBackup({
        database: "j12",
        defaultsFile: "C:\\safe\\db.cnf",
        outputDirectory: os.tmpdir(),
        storageEncrypted: false,
      }),
    (error) => error.code === "RECOVERY_ENCRYPTED_STORAGE_REQUIRED",
  );
});

test("artifact validation detects valid gzip and checksum divergence", async () => {
  const fixture = await createArtifact();
  const validation = await validateArtifact({ artifactPath: fixture.artifact });
  assert.deepEqual(validation.schemaTables, ["users"]);
  await fs.writeFile(fixture.manifest, JSON.stringify({ sha256: "0".repeat(64) }));
  await assert.rejects(
    () => validateArtifact({ artifactPath: fixture.artifact }),
    (error) => error.code === "RECOVERY_CHECKSUM_MISMATCH",
  );
});

test("restore requires an exactly confirmed disposable database before spawning mysql", async () => {
  assert.throws(
    () => assertDisposableDatabase("production", "production"),
    (error) => error.code === "RECOVERY_TARGET_NOT_DISPOSABLE",
  );
  assert.throws(
    () => assertDisposableDatabase("j12_restore_123", "j12_restore_other"),
    (error) => error.code === "RECOVERY_TARGET_CONFIRMATION_MISMATCH",
  );
  const fixture = await createArtifact();
  const calls = [];
  const result = await restoreArtifact({
    artifactPath: fixture.artifact,
    confirmation: "j12_restore_test",
    database: "j12_restore_test",
    defaultsFile: path.join(fixture.directory, "restore.cnf"),
    processFactory: fakeProcessFactory(calls, { mysql: "" }),
  });
  assert.equal(result.restored, true);
  assert.equal(calls[0].args.includes("j12_restore_test"), true);
});

test("structural and integrity verification use read-only inventory plus mysqlcheck", async () => {
  const calls = [];
  const processFactory = fakeProcessFactory(calls, {
    mysql:
      "enrollments\nj12_alunos\nj12_financeiro_cobrancas\nj12_mensalidades\nj12_pagamentos\nusers\n",
    mysqlcheck: "j12_restore_test.users OK\n",
  });
  const result = await verifyRestoredDatabase({
    confirmation: "j12_restore_test",
    database: "j12_restore_test",
    defaultsFile: path.join(os.tmpdir(), "restore.cnf"),
    processFactory,
  });
  assert.equal(result.integrityCheck, "passed");
  assert.deepEqual(
    calls.map((call) => call.command),
    ["mysql", "mysqlcheck"],
  );
});

test("post-restore smoke is read-only and rejects an empty restored schema", async () => {
  const passingCalls = [];
  const passed = await runPostRestoreSmoke({
    confirmation: "j12_restore_test",
    database: "j12_restore_test",
    defaultsFile: path.join(os.tmpdir(), "restore.cnf"),
    processFactory: fakeProcessFactory(passingCalls, { mysql: "tables=12\nledger=1\n" }),
  });
  assert.equal(passed.smoke, "passed");
  assert.match(passingCalls[0].args.at(-1), /^SELECT /);

  await assert.rejects(
    () =>
      runPostRestoreSmoke({
        confirmation: "j12_restore_test",
        database: "j12_restore_test",
        defaultsFile: path.join(os.tmpdir(), "restore.cnf"),
        processFactory: fakeProcessFactory([], { mysql: "tables=0\nledger=0\n" }),
      }),
    (error) => error.code === "RECOVERY_SMOKE_FAILED",
  );
});
test("retention is dry-run by default and only removes named artifacts when applied", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "j12-retention-test-"));
  const old = path.join(output, "j12-backup-20260101T000000Z.sql.gz");
  const unrelated = path.join(output, "keep-me.txt");
  await fs.writeFile(old, "old");
  await fs.writeFile(`${old}.manifest.json`, "{}");
  await fs.writeFile(unrelated, "safe");
  const options = {
    keepDays: 30,
    now: () => new Date("2026-07-12T00:00:00Z"),
    outputDirectory: output,
    repositoryRoot: path.join(output, "not-root"),
  };
  const preview = await applyRetention(options);
  assert.equal(preview.applied, false);
  assert.equal(await exists(old), true);
  await applyRetention({ ...options, apply: true });
  assert.equal(await exists(old), false);
  assert.equal(await exists(unrelated), true);
});

test("logs redact passwords and credential-bearing URLs", () => {
  const sanitized = sanitizeLog("password=super-secret mysql://user:pass@host/db\nnext");
  assert.doesNotMatch(sanitized, /super-secret|user:pass/);
  assert.match(sanitized, /REDACTED/);
});

async function createArtifact() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "j12-artifact-test-"));
  const artifact = path.join(directory, "j12-backup-20260712T180000Z.sql.gz");
  await fs.writeFile(artifact, await gzipAsync("-- MySQL dump\nCREATE TABLE `users` (id INT);\n"));
  return { artifact, directory, manifest: `${artifact}.manifest.json` };
}

function fakeProcessFactory(calls, outputs) {
  return (command, args) => {
    calls.push({ args, command });
    const child = new EventEmitter();
    child.stderr = Readable.from([]);
    child.stdout = Readable.from([outputs[command] || ""]);
    child.stdin = new PassThrough();
    child.stdin.resume();
    const finish = () => setImmediate(() => child.emit("close", 0));
    if (command === "mysql" && !args.includes("--execute")) child.stdin.once("finish", finish);
    else finish();
    return child;
  };
}

function sequenceDates(...values) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
