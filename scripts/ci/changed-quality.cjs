#!/usr/bin/env node
const { execFileSync, spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const base =
  process.env.CI_BASE_SHA || process.argv.find((arg) => arg.startsWith("--base="))?.slice(7);
if (!base || !/^[a-f0-9]{7,40}$/i.test(base)) fail("CI_BASE_SHA (a Git SHA) is required.");
let baseType;
try {
  baseType = execFileSync("git", ["cat-file", "-t", base], { cwd: ROOT, encoding: "utf8" }).trim();
} catch {
  fail(`Comparison base does not exist locally: ${base}`);
}
if (!new Set(["commit", "tree"]).has(baseType))
  fail(`Comparison base must be a commit or tree: ${base}`);
const range = baseType === "commit" ? `${base}...HEAD` : base;
const files = execFileSync(
  "git",
  [
    "-c",
    "core.quotepath=false",
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=ACMR",
    range,
    ...(baseType === "tree" ? ["HEAD"] : []),
  ],
  { cwd: ROOT },
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const eslintFiles = files.filter((file) => /\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(file));
const prettierFiles = files.filter((file) =>
  /\.(?:cjs|mjs|js|jsx|ts|tsx|json|css|md|yml|yaml)$/.test(file),
);

run(process.execPath, [
  path.join(path.dirname(require.resolve("eslint")), "../bin/eslint.js"),
  ...eslintFiles,
]);
run(process.execPath, [
  path.join(ROOT, "node_modules/prettier/bin/prettier.cjs"),
  "--check",
  ...prettierFiles,
]);
execFileSync("git", ["diff", "--check", range, ...(baseType === "tree" ? ["HEAD"] : [])], {
  cwd: ROOT,
  stdio: "inherit",
});
process.stdout.write(`Changed quality gate passed: ${files.length} files.\n`);

function run(command, args) {
  if (args.length <= 1) return;
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
