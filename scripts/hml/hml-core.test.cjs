const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertLocalHttpUrl,
  assertResetConfirmation,
  validateHmlEnvironment,
} = require("./hml-core.cjs");

function safeEnv(overrides = {}) {
  return {
    J12_ENVIRONMENT: "hml",
    HML_ISOLATED: "true",
    HML_REAL_INTEGRATIONS_ENABLED: "false",
    HML_INSTANCE_ID: "hml-local-disposable",
    HML_PUBLIC_URL: "https://hml.invalid",
    HML_API_URL: "http://127.0.0.1:3101",
    DB_HOST: "127.0.0.1",
    DB_NAME: "j12_sports_hml",
    DB_PASSWORD: "local-secret",
    MYSQL_ROOT_PASSWORD: "local-root-secret",
    JWT_SECRET: "x".repeat(32),
    CORS_ORIGIN: "https://hml.invalid",
    APP_BASE_URL: "https://hml.invalid",
    EMAIL_PROVIDER: "disabled",
    INTER_INTEGRATION_MODE: "disabled",
    INTER_BASE_URL: "https://sandbox.invalid",
    INTER_WEBHOOK_URL: "https://hml.invalid/api/webhooks/inter",
    INTER_WEBHOOK_SECRET: "local-webhook-secret",
    RESEND_API_KEY: "",
    BOTCONVERSA_WEBHOOK_URL: "",
    BOTCONVERSA_API_KEY: "",
    N8N_BASE_URL: "",
    N8N_WEBHOOK_URL: "",
    INTER_CLIENT_ID: "",
    INTER_CLIENT_SECRET: "",
    INTER_PIX_KEY: "",
    ...overrides,
  };
}

test("accepts an isolated HML profile", () =>
  assert.equal(validateHmlEnvironment(safeEnv()).ok, true));
test("rejects production database, host and URL", () => {
  const result = validateHmlEnvironment(
    safeEnv({
      DB_NAME: "j12_sports",
      DB_HOST: "108.167.168.27",
      APP_BASE_URL: "https://app.j12sports.com.br",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /DB_NAME/);
  assert.match(result.errors.join(" "), /loopback/);
  assert.match(result.errors.join(" "), /production host/);
});
test("rejects outbound providers and credentials by default", () => {
  const result = validateHmlEnvironment(
    safeEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "real-looking", INTER_CLIENT_ID: "id" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /EMAIL_PROVIDER/);
  assert.match(result.errors.join(" "), /INTER_CLIENT_ID/);
});
test("requires exact reset identity", () => {
  assert.throws(() => assertResetConfirmation(safeEnv(), "RESET:j12_sports_hml"), {
    code: "HML_RESET_CONFIRMATION_REQUIRED",
  });
  assert.equal(
    assertResetConfirmation(safeEnv(), "RESET:hml-local-disposable:j12_sports_hml").database,
    "j12_sports_hml",
  );
});
test("smoke is restricted to loopback", () => {
  assert.equal(assertLocalHttpUrl("http://127.0.0.1:3101").hostname, "127.0.0.1");
  assert.throws(() => assertLocalHttpUrl("https://hml.app.j12sports.com.br"), {
    code: "HML_SMOKE_TARGET_UNSAFE",
  });
});
