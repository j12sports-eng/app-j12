#!/usr/bin/env node

const { CanonicalMigrationRunner } = require("./canonical-migration-runner.js");
const { discoverMigrationCatalog } = require("./migration-catalog.js");

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  const catalog = await discoverMigrationCatalog();
  if (options.command === "plan" || (options.command === "up" && options.dryRun)) {
    const result = await new CanonicalMigrationRunner({ catalog }).up({ dryRun: true });
    printJson(result);
    return result;
  }

  assertExplicitDatabaseTarget(options, env);
  process.env.J12_MIGRATION_RUNNER_CONTEXT = "true";
  // Import delayed deliberately: plan/dry-run cannot even create a database pool.
  const database = require("../../config/db.js");
  const { MigrationExecutor } = require("./migration-executor.js");
  const { MySqlMigrationLedger } = require("./mysql-migration-ledger.js");
  const runner = new CanonicalMigrationRunner({
    catalog,
    executor: new MigrationExecutor({ query: database.query }),
    ledger: new MySqlMigrationLedger({ pool: database.pool }),
  });
  try {
    const result = options.command === "status" ? await runner.status() : await runner.up();
    printJson(result);
    return result;
  } finally {
    await database.pool.end();
  }
}

function parseArguments(argv) {
  const command = argv[0] || "plan";
  if (!["plan", "status", "up"].includes(command))
    throw cliError("Use plan, status or up.", "MIGRATION_COMMAND_INVALID");
  const confirmArgument = argv.find((argument) => argument.startsWith("--confirm-database="));
  return {
    allowRemote: argv.includes("--allow-remote"),
    command,
    confirmDatabase: confirmArgument ? confirmArgument.slice("--confirm-database=".length) : null,
    dryRun: argv.includes("--dry-run"),
  };
}

function assertExplicitDatabaseTarget(options, env) {
  const databaseName = String(env.DB_NAME || env.DB_DATABASE || "").trim();
  const host = String(env.DB_HOST || "")
    .trim()
    .toLowerCase();
  if (!databaseName || options.confirmDatabase !== databaseName)
    throw cliError(
      "Refusing database access: pass --confirm-database=<exact DB_NAME>.",
      "MIGRATION_DATABASE_CONFIRMATION_REQUIRED",
    );
  if (!new Set(["127.0.0.1", "::1", "localhost"]).has(host) && !options.allowRemote)
    throw cliError(
      "Refusing remote database access without --allow-remote.",
      "MIGRATION_REMOTE_DATABASE_BLOCKED",
    );
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
function cliError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

if (require.main === module)
  main().catch((error) => {
    process.stderr.write(`${error.code || "MIGRATION_RUNNER_ERROR"}: ${error.message}\n`);
    process.exitCode = 1;
  });

module.exports = { assertExplicitDatabaseTarget, main, parseArguments };
