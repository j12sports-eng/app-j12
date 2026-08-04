#!/usr/bin/env node
"use strict";

const path = require("node:path");
require("dotenv").config({
  path: [path.resolve(__dirname, "../../../../.env"), path.resolve(__dirname, "../../../.env")],
  quiet: true,
});

const { EXIT_CODES } = require("../j12-doctor/constants");
const {
  databaseConfigFromEnv,
  createDoctorDatabaseClient,
} = require("../j12-doctor/database-client");
const {
  DoctorUsageError,
  assertDatabaseTarget,
  isLocalHost,
} = require("../j12-doctor/database-target-guard");
const {
  MigrationManagerUnavailableError,
  MigrationManagerUsageError,
  RESERVED_COMMANDS,
  SUPPORTED_COMMANDS,
} = require("./constants");
const { formatConsole, formatJson } = require("./formatter");
const { MigrationManager } = require("./manager");
const { ControlledBaselineError } = require("./baseline-errors");
const { ControlledApplyOneError } = require("./apply-one-errors");
const { createApplyOneWriteClient } = require("./apply-one-database-client");
const { createBaselineWriteClient } = require("./write-database-client");
const {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_TABLES,
} = require("./baseline-adoptions/auth-runtime.adoption");

const ALL_COMMANDS = new Set([...SUPPORTED_COMMANDS, ...RESERVED_COMMANDS]);

function usage() {
  return [
    "Uso: node backend/src/database/migration-manager/cli.js <comando> --confirm-database=<nome> [--allow-remote] [--format=console|json]",
    "Dry-run: baseline --dry-run | apply-one --dry-run --migration=<id>",
    "Baseline write: baseline --write --only=<id1,id2> --confirm-baseline=<token>",
    "Apply-one write: apply-one --write --migration=<id> --confirm-apply=<token> --confirm-backup=<id> --confirm-tables=<t1,t2>",
    "Comandos disponíveis: plan, baseline, apply-one, validate",
    "Reservados e bloqueados: apply, report",
  ].join("\n");
}

function parseArguments(argv) {
  const command = argv[0];
  if (!ALL_COMMANDS.has(command)) throw new MigrationManagerUsageError(usage());
  const options = {
    command,
    allowRemote: false,
    confirmDatabase: null,
    dryRun: false,
    write: false,
    onlyIds: null,
    confirmBaseline: null,
    migrationId: null,
    confirmApply: null,
    backupIdentifier: null,
    confirmedTables: null,
    format: "console",
  };
  for (const argument of argv.slice(1)) {
    if (argument === "--allow-remote") options.allowRemote = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--write") options.write = true;
    else if (argument.startsWith("--only="))
      options.onlyIds = argument
        .slice("--only=".length)
        .split(",")
        .map((id) => id.trim());
    else if (argument.startsWith("--confirm-baseline="))
      options.confirmBaseline = argument.slice("--confirm-baseline=".length);
    else if (argument.startsWith("--migration="))
      options.migrationId = argument.slice("--migration=".length);
    else if (argument.startsWith("--confirm-apply="))
      options.confirmApply = argument.slice("--confirm-apply=".length);
    else if (argument.startsWith("--confirm-backup="))
      options.backupIdentifier = argument.slice("--confirm-backup=".length);
    else if (argument.startsWith("--confirm-tables="))
      options.confirmedTables = argument
        .slice("--confirm-tables=".length)
        .split(",")
        .map((table) => table.trim())
        .filter(Boolean);
    else if (argument.startsWith("--confirm-database="))
      options.confirmDatabase = argument.slice("--confirm-database=".length);
    else if (argument.startsWith("--format=")) options.format = argument.slice("--format=".length);
    else throw new MigrationManagerUsageError(`Argumento desconhecido.\n${usage()}`);
  }
  if (!SUPPORTED_COMMANDS.includes(command)) throw new MigrationManagerUnavailableError(command);
  const controlledCommand = command === "baseline" || command === "apply-one";
  if (controlledCommand && options.dryRun === options.write)
    throw new MigrationManagerUsageError(
      `${command} exige exatamente um modo: --dry-run ou --write.`,
    );
  if (!controlledCommand && options.dryRun)
    throw new MigrationManagerUsageError("--dry-run é aceito apenas por baseline e apply-one.");
  if (options.dryRun && options.write)
    throw new MigrationManagerUsageError("--dry-run e --write são mutuamente exclusivos.");
  if (!controlledCommand && options.write)
    throw new MigrationManagerUsageError("--write é aceito apenas por baseline e apply-one.");
  if (
    command === "baseline" &&
    options.write &&
    (!options.onlyIds || options.onlyIds.some((id) => !id))
  )
    throw new MigrationManagerUsageError("baseline --write exige --only=<id1,id2,...>.");
  if (command === "baseline" && options.write && !options.confirmBaseline)
    throw new MigrationManagerUsageError("baseline --write exige --confirm-baseline=<token>.");
  if (command !== "baseline" || !options.write) {
    if (options.onlyIds)
      throw new MigrationManagerUsageError("--only é aceito apenas com baseline --write.");
    if (options.confirmBaseline)
      throw new MigrationManagerUsageError(
        "--confirm-baseline é aceito apenas com baseline --write.",
      );
  }
  if (command === "apply-one" && !options.migrationId)
    throw new MigrationManagerUsageError("apply-one exige --migration=<id>.");
  if (command !== "apply-one" && options.migrationId)
    throw new MigrationManagerUsageError("--migration é aceito apenas por apply-one.");
  if (command === "apply-one" && options.write && !options.confirmApply)
    throw new MigrationManagerUsageError("apply-one --write exige --confirm-apply=<token>.");
  if (command === "apply-one" && options.write && !options.backupIdentifier)
    throw new MigrationManagerUsageError(
      "apply-one --write exige --confirm-backup=<identificador>.",
    );
  if (
    command === "apply-one" &&
    options.write &&
    options.migrationId === AUTH_RUNTIME_CORRECTIVE_MIGRATION &&
    !options.confirmedTables
  )
    throw new MigrationManagerUsageError(
      "A correção do Auth Runtime exige --confirm-tables=users,user_sessions,password_reset_tokens.",
    );
  if (
    command === "apply-one" &&
    options.write &&
    options.migrationId === AUTH_RUNTIME_CORRECTIVE_MIGRATION &&
    options.confirmedTables &&
    (options.confirmedTables.length !== AUTH_RUNTIME_TABLES.length ||
      [...options.confirmedTables]
        .sort()
        .some((table, index) => table !== [...AUTH_RUNTIME_TABLES].sort()[index]))
  )
    throw new MigrationManagerUsageError(
      "A lista --confirm-tables deve corresponder exatamente a users,user_sessions,password_reset_tokens.",
    );
  if (command !== "apply-one" || !options.write) {
    if (options.confirmApply)
      throw new MigrationManagerUsageError(
        "--confirm-apply é aceito apenas com apply-one --write.",
      );
    if (options.backupIdentifier)
      throw new MigrationManagerUsageError(
        "--confirm-backup é aceito apenas com apply-one --write.",
      );
    if (options.confirmedTables)
      throw new MigrationManagerUsageError(
        "--confirm-tables é aceito apenas com apply-one --write.",
      );
  }
  if (!["console", "json"].includes(options.format))
    throw new MigrationManagerUsageError("--format deve ser console ou json.");
  return options;
}

function isConnectionError(error) {
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ER_ACCESS_DENIED_ERROR",
    "ER_BAD_DB_ERROR",
    "PROTOCOL_CONNECTION_LOST",
  ].includes(error?.code);
}

function safeErrorCode(error) {
  return String(error?.code || error?.name || "UNKNOWN_ERROR").replace(/[^A-Z0-9_-]/gi, "_");
}

function resultExitCode(result) {
  const severity = result.doctorSummary?.severityCounts || {};
  if (Number(severity.CRITICAL || 0) > 0) return EXIT_CODES.CRITICAL;
  if (
    Number(severity.HIGH || 0) > 0 ||
    Number(severity.WARNING || 0) > 0 ||
    Number(result.summary?.drift || 0) > 0 ||
    result.valid === false
  )
    return EXIT_CODES.FINDINGS;
  return EXIT_CODES.CLEAN;
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const output = dependencies.output || process.stdout;
  const errorOutput = dependencies.errorOutput || process.stderr;
  const env = dependencies.env || process.env;
  const createClient = dependencies.createClient || createDoctorDatabaseClient;
  const createWriteClient = dependencies.createWriteClient || createBaselineWriteClient;
  const createApplyClient = dependencies.createApplyClient || createApplyOneWriteClient;
  const manager = dependencies.manager || new MigrationManager();
  let client;
  try {
    const options = parseArguments(argv);
    const config = databaseConfigFromEnv(env);
    assertDatabaseTarget({
      configuredDatabase: config.database,
      configuredHost: config.host,
      confirmDatabase: options.confirmDatabase,
      allowRemote: options.allowRemote,
    });
    client = createClient(config);
    const context = {
      reader: client,
      databaseName: config.database,
      databaseHost: config.host,
      databaseRemote: !isLocalHost(config.host),
      migrationId: options.migrationId,
    };
    let result;
    if (options.command === "baseline" && options.write) {
      result = await manager.runBaselineWrite({
        ...context,
        onlyIds: options.onlyIds,
        confirmationToken: options.confirmBaseline,
        writeClientFactory: () => createWriteClient(config),
      });
    } else if (options.command === "apply-one" && options.write) {
      result = await manager.runApplyOneWrite({
        ...context,
        confirmationToken: options.confirmApply,
        backupIdentifier: options.backupIdentifier,
        confirmedTables: options.confirmedTables,
        writeClientFactory: () => createApplyClient(config),
      });
    } else {
      result = await manager.run(options.command, context);
    }
    output.write(options.format === "json" ? formatJson(result) : formatConsole(result));
    return resultExitCode(result);
  } catch (error) {
    if (
      error instanceof MigrationManagerUsageError ||
      error instanceof MigrationManagerUnavailableError ||
      error instanceof DoctorUsageError
    ) {
      errorOutput.write(`${error.message}\n`);
      return EXIT_CODES.USAGE;
    }
    const code = safeErrorCode(error);
    if (isConnectionError(error)) {
      errorOutput.write(`Falha de conexão com o banco confirmado (${code}).\n`);
      return EXIT_CODES.CONNECTION;
    }
    if (error instanceof ControlledBaselineError || error instanceof ControlledApplyOneError) {
      errorOutput.write(`${code}: ${error.message}\n`);
      return EXIT_CODES.CRITICAL;
    }
    errorOutput.write(`Falha interna do J12 Migration Manager (${code}).\n`);
    return EXIT_CODES.INTERNAL;
  } finally {
    if (client?.close) {
      try {
        await client.close();
      } catch (error) {
        errorOutput.write(`Aviso: falha ao encerrar a conexão (${safeErrorCode(error)}).\n`);
      }
    }
  }
}

if (require.main === module)
  main().then((code) => {
    process.exitCode = code;
  });

module.exports = {
  ALL_COMMANDS,
  isConnectionError,
  main,
  parseArguments,
  resultExitCode,
  safeErrorCode,
  usage,
};
