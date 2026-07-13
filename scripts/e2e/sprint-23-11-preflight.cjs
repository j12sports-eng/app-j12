#!/usr/bin/env node
const { assertSprint2311Environment } = require("./sprint-23-11-environment.cjs");

try {
  const result = assertSprint2311Environment(process.env);
  process.stdout.write(`${JSON.stringify({ ok: true, ...result.identity }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.code || "E2E_PREFLIGHT_FAILED"}: ${error.message}\n`);
  process.exitCode = 1;
}
