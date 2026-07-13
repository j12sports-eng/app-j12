const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SCENARIOS,
  assertExternalAuthorization,
  buildOfflineAudit,
  validateExternalAuthorization,
} = require("./external-financial-gate.cjs");

function baseEnv(overrides = {}) {
  return {
    J12_ENVIRONMENT: "hml",
    HML_ISOLATED: "true",
    HML_INSTANCE_ID: "hml-finance-sandbox",
    HML_PUBLIC_URL: "https://hml.invalid",
    HML_API_URL: "http://127.0.0.1:3101",
    DB_HOST: "127.0.0.1",
    DB_NAME: "j12_finance_hml",
    DB_PASSWORD: "secret",
    MYSQL_ROOT_PASSWORD: "root-secret",
    JWT_SECRET: "x".repeat(32),
    CORS_ORIGIN: "https://hml.invalid",
    APP_BASE_URL: "https://hml.invalid",
    INTER_WEBHOOK_URL: "https://hml.invalid/api/webhooks/inter",
    EXTERNAL_FINANCIAL_HML_ENABLED: "true",
    EXTERNAL_FINANCIAL_NON_PRODUCTION_CONFIRMED: "true",
    EXTERNAL_FINANCIAL_REAL_TRANSACTION_BLOCKED: "true",
    EXTERNAL_FINANCIAL_AUTHORIZATION_ID: "AUTH-HML-20260712-A",
    EXTERNAL_FINANCIAL_SANDBOX_HOSTS: "inter-sandbox.test,n8n-sandbox.test",
    INTER_BASE_URL: "https://inter-sandbox.test",
    N8N_BASE_URL: "https://n8n-sandbox.test",
    INTER_CLIENT_ID: "sandbox-id",
    INTER_CLIENT_SECRET: "sandbox-secret",
    INTER_PIX_KEY: "sandbox-pix-key",
    INTER_WEBHOOK_SECRET: "sandbox-webhook",
    N8N_SERVICE_TOKEN: "sandbox-n8n-token",
    INTER_CERT_PATH: "certs/hml/sandbox.crt",
    INTER_KEY_PATH: "certs/hml/sandbox.key",
    ...overrides,
  };
}

test("offline audit covers every required scenario and never authorizes calls", () => {
  const audit = buildOfflineAudit({});
  assert.equal(audit.externalCalls, false);
  assert.equal(audit.readyForExternalExecution, false);
  assert.deepEqual(
    audit.scenarios.map((item) => item.id),
    [...SCENARIOS],
  );
});
test("authorization accepts only explicit sandbox configuration and confirmation", () => {
  const env = baseEnv();
  const result = validateExternalAuthorization(env, {
    checkFiles: false,
    confirmation: "AUTHORIZE:hml-finance-sandbox:AUTH-HML-20260712-A",
  });
  assert.equal(result.ok, true, result.errors.join(" "));
});
test("production Inter and n8n hosts are rejected", () => {
  const result = validateExternalAuthorization(
    baseEnv({
      EXTERNAL_FINANCIAL_SANDBOX_HOSTS: "cdpj.partners.bancointer.com.br,n8n.j12sports.com.br",
      INTER_BASE_URL: "https://cdpj.partners.bancointer.com.br",
      N8N_BASE_URL: "https://n8n.j12sports.com.br",
    }),
    { checkFiles: false, confirmation: "AUTHORIZE:hml-finance-sandbox:AUTH-HML-20260712-A" },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /production host/);
});
test("missing confirmations and secrets fail closed", () => {
  const result = validateExternalAuthorization(
    baseEnv({ EXTERNAL_FINANCIAL_NON_PRODUCTION_CONFIRMED: "false", INTER_CLIENT_SECRET: "" }),
    { checkFiles: false },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /NON_PRODUCTION/);
  assert.match(result.errors.join(" "), /INTER_CLIENT_SECRET/);
  assert.match(result.errors.join(" "), /Exact execution confirmation/);
});
test("credential files must exist when operational authorization is evaluated", () => {
  assert.throws(
    () =>
      assertExternalAuthorization(baseEnv(), {
        confirmation: "AUTHORIZE:hml-finance-sandbox:AUTH-HML-20260712-A",
      }),
    { code: "EXTERNAL_FINANCIAL_HML_NOT_AUTHORIZED" },
  );
});
