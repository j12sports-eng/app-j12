#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const suite = process.argv[2];

const selectors = {
  backend: (file) => file.startsWith("backend/src/") && file.endsWith(".test.js"),
  frontend: (file) => file.startsWith("src/") && file.endsWith(".test.mjs"),
  security: (file) => file.startsWith("backend/src/security/tests/") && file.endsWith(".test.js"),
  migrations: (file) =>
    file.endsWith(".test.js") &&
    (file.includes("/database/migration-runner/") ||
      file.includes("/database/migrations/") ||
      file.toLowerCase().includes("migration") ||
      file.endsWith("runtime-ddl-integration.test.js")),
};

if (!selectors[suite]) fail(`Unknown suite: ${suite || "<missing>"}`);
const files = walk(ROOT)
  .map((file) => path.relative(ROOT, file).replaceAll("\\", "/"))
  .filter(selectors[suite])
  .sort();
if (files.length === 0) fail(`No tests discovered for suite: ${suite}`);

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: ROOT,
  encoding: "utf8",
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;

function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "dist-ssr"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
