#!/usr/bin/env node

const path = require("node:path");
const {
  applyRetention,
  createBackup,
  restoreArtifact,
  runPostRestoreSmoke,
  validateArtifact,
  verifyRestoredDatabase,
} = require("./recovery-core.cjs");

async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArguments(argv);
  let result;

  if (command === "backup") {
    result = await createBackup({
      database: options.database,
      defaultsFile: options.defaultsFile,
      gitSha: options.gitSha,
      outputDirectory: options.outputDir,
      repositoryRoot: process.cwd(),
      storageEncrypted: options.storageEncrypted === true,
    });
  } else if (command === "validate") {
    result = await validateArtifact({ artifactPath: options.artifact });
  } else if (command === "restore") {
    result = await restoreArtifact(restoreOptions(options));
  } else if (command === "verify") {
    result = await verifyRestoredDatabase(restoreOptions(options));
  } else if (command === "smoke") {
    result = await runPostRestoreSmoke(restoreOptions(options));
  } else if (command === "retention") {
    result = await applyRetention({
      apply: options.apply === true,
      keepDays: options.keepDays,
      outputDirectory: options.outputDir,
      repositoryRoot: process.cwd(),
    });
  } else if (command === "drill") {
    result = await runDrill(options);
  } else {
    throw cliError(
      "Use backup, validate, restore, verify, smoke, retention or drill.",
      "RECOVERY_COMMAND_INVALID",
    );
  }

  process.stdout.write(`${JSON.stringify(publicResult(result), null, 2)}\n`);
  return result;
}

async function runDrill(options) {
  const startedAt = new Date();
  const validation = await validateArtifact({ artifactPath: options.artifact });
  await restoreArtifact(restoreOptions(options));
  const integrity = await verifyRestoredDatabase(restoreOptions(options));
  const smoke = await runPostRestoreSmoke(restoreOptions(options));
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const rtoMinutes = positiveNumber(options.rtoMinutes, "rtoMinutes");
  const rpoHours = positiveNumber(options.rpoHours, "rpoHours");
  const backupCreatedAt = validation.manifest?.createdAt
    ? new Date(validation.manifest.createdAt)
    : null;
  if (!backupCreatedAt || Number.isNaN(backupCreatedAt.getTime())) {
    throw cliError(
      "Recovery drill requires a manifest with createdAt.",
      "RECOVERY_MANIFEST_TIMESTAMP_REQUIRED",
    );
  }
  const ageMs = startedAt.getTime() - backupCreatedAt.getTime();
  return {
    classification: "proved_on_disposable_database",
    durationMs,
    finishedAt: finishedAt.toISOString(),
    integrity,
    rpo: {
      actualHours: Number((ageMs / 3600000).toFixed(2)),
      objectiveHours: rpoHours,
      passed: ageMs <= rpoHours * 3600000,
    },
    rto: {
      actualMinutes: Number((durationMs / 60000).toFixed(2)),
      objectiveMinutes: rtoMinutes,
      passed: durationMs <= rtoMinutes * 60000,
    },
    smoke,
    startedAt: startedAt.toISOString(),
    validation: {
      bytes: validation.bytes,
      schemaTables: validation.schemaTables.length,
      sha256: validation.sha256,
    },
  };
}

function restoreOptions(options) {
  return {
    artifactPath: options.artifact,
    confirmation: options.confirmDatabase,
    database: options.database,
    defaultsFile: options.defaultsFile,
  };
}

function parseArguments(argv) {
  const command = argv[0] || "";
  const options = {};
  for (const argument of argv.slice(1)) {
    if (argument === "--apply") options.apply = true;
    else if (argument === "--storage-encrypted") options.storageEncrypted = true;
    else if (argument.startsWith("--") && argument.includes("=")) {
      const [rawKey, ...parts] = argument.slice(2).split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[key] = parts.join("=");
    } else throw cliError(`Invalid argument: ${argument}.`, "RECOVERY_ARGUMENT_INVALID");
  }
  return { command, options };
}

function positiveNumber(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw cliError(`Recovery drill requires positive ${field}.`, "RECOVERY_OBJECTIVE_INVALID");
  return parsed;
}

function publicResult(value) {
  if (!value || typeof value !== "object") return value;
  const result = { ...value };
  for (const key of ["artifactPath", "manifestPath"]) {
    if (result[key]) result[key] = path.basename(result[key]);
  }
  return result;
}

function cliError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.code || "RECOVERY_ERROR"}: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments, publicResult, runDrill };
