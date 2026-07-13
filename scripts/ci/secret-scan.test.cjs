const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.join(__dirname, "secret-scan.cjs");

test("secret scanner handles portable inventory and narrow fixtures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "j12-secret-scan-"));
  try {
    git(root, ["init"]);
    write(root, ".gitignore", "ignored.txt\n");
    write(root, "migrations/001 criação inicial.sql", "CREATE TABLE safe_fixture (id INT);\n");
    write(root, "docs/nome com espaço.md", "safe content\n");
    write(
      root,
      "src/example.test.js",
      'process.env.JWT_SECRET = "fixture-only-not-a-real-secret";\n' +
        'const key = "-----BEGIN ' +
        'PRIVATE KEY-----\\nfixture-only\\n-----END PRIVATE KEY-----";\n',
    );
    write(root, "ignored.txt", "ghp_" + "abcdefghijklmnopqrstuvwxyz1234567890\n");
    git(root, ["add", ".gitignore", "migrations", "docs", "src"]);
    assert.equal(run(root).status, 0, "safe Unicode, spaces, migration and narrow fixture pass");

    write(
      root,
      "real-key.pem",
      "-----BEGIN " + "PRIVATE KEY-----\nREAL_SECRET_MATERIAL\n-----END PRIVATE KEY-----\n",
    );
    const privateKey = run(root);
    assert.notEqual(privateKey.status, 0, "real private key is blocked");
    assert.doesNotMatch(privateKey.stderr, /REAL_SECRET_MATERIAL/, "secret value is not logged");
    fs.rmSync(path.join(root, "real-key.pem"));

    write(root, "backup-production.sql", "SELECT 1;\n");
    assert.notEqual(run(root).status, 0, "SQL backup is blocked while migrations remain allowed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function run(root) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI_SECRET_SCAN_ROOT: root },
  });
}
function git(root, args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}
function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
