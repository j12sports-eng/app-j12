const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseArguments,
  resolveSafeConfig,
  sanitizedFailure,
} = require("../validate-person-identity-mysql.js");

const LOCAL_ENV = Object.freeze({
  IDENTITY_MYSQL_DATABASE: "j12_identity_validation_test",
  IDENTITY_MYSQL_HOST: "127.0.0.1",
  IDENTITY_MYSQL_PASSWORD: "synthetic-local-only",
  IDENTITY_MYSQL_PORT: "33317",
  IDENTITY_MYSQL_USER: "j12_identity_validator",
});

test("fails closed without explicit local confirmation", () => {
  assert.throws(() => resolveSafeConfig({}, LOCAL_ENV), /LOCAL_CONFIRMATION_REQUIRED/u);
});

test("blocks remote hosts and non-disposable database names", () => {
  assert.throws(
    () =>
      resolveSafeConfig(
        { confirmLocal: true },
        { ...LOCAL_ENV, IDENTITY_MYSQL_HOST: "db.example" },
      ),
    /REMOTE_HOST_BLOCKED/u,
  );
  assert.throws(
    () => resolveSafeConfig({ confirmLocal: true, database: "j12_sports" }, LOCAL_ENV),
    /DATABASE_NAME_BLOCKED/u,
  );
});

test("ignores global DB variables", () => {
  const config = resolveSafeConfig(
    { confirmLocal: true },
    {
      ...LOCAL_ENV,
      DB_HOST: "remote.example",
      DB_NAME: "production",
      DB_PASSWORD: "must-not-be-used",
    },
  );
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.database, "j12_identity_validation_test");
});

test("parses closed modes and rejects unsupported parameters", () => {
  assert.deepEqual(parseArguments(["full", "--confirm-local", "--batch-size=7"]), {
    batchSize: 7,
    confirmLocal: true,
    mode: "full",
  });
  assert.throws(() => parseArguments(["production"]), /Unsupported mode/u);
  assert.throws(() => parseArguments(["full", "--allow-remote"]), /Unsupported argument/u);
});

test("sanitizes failures", () => {
  const report = sanitizedFailure(new Error("REMOTE_HOST_BLOCKED"));
  assert.deepEqual(report, { code: "REMOTE_HOST_BLOCKED", ok: false });
  assert.doesNotMatch(JSON.stringify(report), /password|connection|string|cpf|email/iu);
});
