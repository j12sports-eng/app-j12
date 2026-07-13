#!/usr/bin/env node
const path = require("node:path");
const {
  assertLocalHttpUrl,
  assertResetConfirmation,
  assertValidHmlEnvironment,
  run,
} = require("./hml-core.cjs");

const composeFile = path.resolve(__dirname, "../../deploy/hml/docker-compose.hml.yml");
const migrationCli = path.resolve(__dirname, "../../backend/src/database/migration-runner/cli.js");

async function main(argv = process.argv.slice(2), env = process.env) {
  const command = argv[0] || "validate";
  if (command === "validate") return print(assertValidHmlEnvironment(env));
  if (command === "plan-migrations") {
    assertValidHmlEnvironment(env);
    return run(process.execPath, [migrationCli, "up", "--dry-run"], { env });
  }
  if (command === "reset") {
    const confirmation = valueOf(argv, "--confirm=");
    assertResetConfirmation(env, confirmation);
    if (!argv.includes("--apply"))
      return print({
        dryRun: true,
        action: "docker compose down --volumes",
        project: "j12-hml-isolated",
      });
    await run("docker", [
      "compose",
      "--env-file",
      valueOf(argv, "--env-file="),
      "-f",
      composeFile,
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
    return print({ reset: true, database: env.DB_NAME });
  }
  if (command === "smoke") {
    assertValidHmlEnvironment(env);
    const base = assertLocalHttpUrl(valueOf(argv, "--base-url=") || env.HML_API_URL);
    const response = await fetch(new URL("/health", base), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw error(`Health returned HTTP ${response.status}.`, "HML_SMOKE_FAILED");
    const body = await response.json();
    return print({
      ok: true,
      status: response.status,
      environment: env.J12_ENVIRONMENT,
      instanceId: env.HML_INSTANCE_ID,
      health: body.status || null,
    });
  }
  throw error("Use validate, plan-migrations, reset or smoke.", "HML_COMMAND_INVALID");
}

function valueOf(argv, prefix) {
  const found = argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}
function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return value;
}
function error(message, code) {
  const result = new Error(message);
  result.code = code;
  return result;
}
if (require.main === module)
  main().catch((cause) => {
    process.stderr.write(`${cause.code || "HML_ERROR"}: ${cause.message}\n`);
    process.exitCode = 1;
  });
module.exports = { main };
