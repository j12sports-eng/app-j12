const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

test("legacy SQLite adapter fails before runtime schema initialization in production", () => {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, "..", "..", "..", "server", "database.mjs"),
  ).href;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `import(${JSON.stringify(moduleUrl)})`],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Legacy SQLite runtime schema is disabled in production/);
});
