const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const read = (file) => readFile(path.join(ROOT, file), "utf8");

test("AlmaLinux preflight checks OS, SELinux, firewalld, Nginx and private ports", async () => {
  const source = await read("deploy/almalinux/preflight.sh");
  for (const token of [
    'ID:-}" == "almalinux"',
    "VERSION_ID",
    "getenforce",
    "firewall-cmd",
    "nginx -t",
    "3001|4173",
  ])
    assert.match(source, new RegExp(token.replace(/[|]/g, "\\|")));
  assert.doesNotMatch(source, /apt-get|setenforce\s+0|systemctl\s+disable\s+firewalld/);
});
test("deploy builds before atomic link, never applies migrations and auto-restores previous release", async () => {
  const source = await read("deploy/almalinux/deploy-release.sh");
  assert.ok(source.indexOf("npm run build") < source.indexOf('atomic_link "$release"'));
  assert.match(source, /up --dry-run/);
  assert.doesNotMatch(source, /cli\.js up --confirm-database|migration.*\bDOWN\b/i);
  assert.match(source, /atomic_link "\$previous"/);
  assert.match(source, /flock -n/);
  assert.match(source, /release id does not match source HEAD/);
  assert.match(source, /status --porcelain/);
});
test("release excludes secrets and links shared env, certs and logs", async () => {
  const source = await read("deploy/almalinux/deploy-release.sh");
  assert.match(source, /--exclude='\.env\*'/);
  assert.match(source, /ln -s "\$J12_ENV_FILE"/);
  assert.match(source, /ln -s "\$J12_CERTS_DIR"/);
  assert.match(source, /ln -s "\$J12_LOGS_DIR"/);
  assert.match(source, /assert_secret_permissions/);
});
test("rollback requires exact release identity, smoke and leaves migrations untouched", async () => {
  const source = await read("deploy/almalinux/rollback.sh");
  assert.match(source, /ROLLBACK:\$RELEASE_ID/);
  assert.match(source, /smoke_release/);
  assert.match(source, /migrations=untouched/);
  assert.doesNotMatch(source, /migration-runner|npm ci|npm run build/);
});
test("atomic link uses GNU rename and PM2 uses the selected immutable release", async () => {
  const source = await read("deploy/almalinux/lib.sh");
  assert.match(source, /mv -Tf "\$temporary" "\$J12_CURRENT_LINK"/);
  assert.match(source, /pm2 startOrReload "\$release\/\$J12_PM2_CONFIG" --update-env/);
});
