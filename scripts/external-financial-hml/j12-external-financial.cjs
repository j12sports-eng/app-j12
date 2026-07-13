#!/usr/bin/env node
const {
  SCENARIOS,
  assertExternalAuthorization,
  buildOfflineAudit,
} = require("./external-financial-gate.cjs");

function main(argv = process.argv.slice(2), env = process.env) {
  const command = argv[0] || "audit";
  if (command === "audit" || command === "plan") return print(buildOfflineAudit(env));
  if (command === "authorize") {
    const result = assertExternalAuthorization(env, {
      confirmation: valueOf(argv, "--confirm="),
    });
    return print({
      ...result,
      externalCalls: false,
      message: "Authorization preflight passed; this command never performs external calls.",
      scenarios: SCENARIOS,
    });
  }
  throw controlledError("Use audit, plan or authorize.", "EXTERNAL_FINANCIAL_COMMAND_INVALID");
}

function valueOf(argv, prefix) {
  const found = argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}
function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return value;
}
function controlledError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
if (require.main === module)
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`${error.code || "EXTERNAL_FINANCIAL_ERROR"}: ${error.message}\n`);
    process.exitCode = 1;
  });
module.exports = { main };
