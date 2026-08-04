#!/usr/bin/env node
"use strict";

const path = require("node:path");
require("dotenv").config({
  path: [path.resolve(__dirname, "../../../../.env"), path.resolve(__dirname, "../../../.env")],
  quiet: true,
});

const { EXIT_CODES } = require("./constants");
const { DoctorUsageError, assertDatabaseTarget, isLocalHost } = require("./database-target-guard");
const { databaseConfigFromEnv, createDoctorDatabaseClient } = require("./database-client");
const { runDoctor } = require("./doctor");
const { exitCodeForReport } = require("./exit-code");
const { formatConsole, formatJson } = require("./report-formatters");

const COMMANDS = new Set(["inspect", "report", "check-migrations", "check-schema", "check-drift"]);

function usage() {
  return [
    "Uso: node backend/src/database/j12-doctor/cli.js <comando> --confirm-database=<nome> [--allow-remote] [--format=console|json]",
    "Comandos: inspect, report, check-migrations, check-schema, check-drift",
    "O utilitário é estritamente somente leitura e nunca aplica migrations.",
  ].join("\n");
}

function parseArgs(argv) {
  const command = argv[0];
  if (!COMMANDS.has(command)) throw new DoctorUsageError(usage());
  const options = {
    command,
    allowRemote: false,
    confirmDatabase: null,
    format: command === "report" ? "json" : "console",
  };
  for (const argument of argv.slice(1)) {
    if (argument === "--allow-remote") options.allowRemote = true;
    else if (argument.startsWith("--confirm-database="))
      options.confirmDatabase = argument.slice("--confirm-database=".length);
    else if (argument.startsWith("--format=")) options.format = argument.slice("--format=".length);
    else throw new DoctorUsageError(`Argumento desconhecido.\n${usage()}`);
  }
  if (!["console", "json"].includes(options.format))
    throw new DoctorUsageError("--format deve ser console ou json.");
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

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const output = dependencies.output || process.stdout;
  const errorOutput = dependencies.errorOutput || process.stderr;
  const env = dependencies.env || process.env;
  const createClient = dependencies.createClient || createDoctorDatabaseClient;
  const executeDoctor = dependencies.executeDoctor || runDoctor;
  let client;
  try {
    const options = parseArgs(argv);
    const config = databaseConfigFromEnv(env);
    assertDatabaseTarget({
      configuredDatabase: config.database,
      configuredHost: config.host,
      confirmDatabase: options.confirmDatabase,
      allowRemote: options.allowRemote,
    });
    client = createClient(config);
    const report = await executeDoctor({
      reader: client,
      databaseName: config.database,
      databaseHost: config.host,
      databaseRemote: !isLocalHost(config.host),
    });
    output.write(
      options.format === "json" ? formatJson(report) : formatConsole(report, options.command),
    );
    return exitCodeForReport(report);
  } catch (error) {
    if (error instanceof DoctorUsageError) {
      errorOutput.write(`${error.message}\n`);
      return EXIT_CODES.USAGE;
    }
    error.message = safeErrorCode(error);
    if (isConnectionError(error)) {
      errorOutput.write(`Falha de conexão com o banco confirmado: ${error.message}\n`);
      return EXIT_CODES.CONNECTION;
    }
    errorOutput.write(`Falha interna do J12 Doctor: ${error.message}\n`);
    return EXIT_CODES.INTERNAL;
  } finally {
    if (client?.close) {
      try {
        await client.close();
      } catch (error) {
        error.message = safeErrorCode(error);
        errorOutput.write(`Aviso: falha ao encerrar a conexão: ${error.message}\n`);
      }
    }
  }
}

if (require.main === module)
  main().then((code) => {
    process.exitCode = code;
  });

module.exports = { COMMANDS, isConnectionError, main, parseArgs, safeErrorCode, usage };
