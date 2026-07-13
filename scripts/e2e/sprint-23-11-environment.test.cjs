const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertSprint2311Environment,
  validateSprint2311Environment,
} = require("./sprint-23-11-environment.cjs");

function safeEnv(overrides = {}) {
  return {
    J12_ENVIRONMENT: "e2e-local",
    HML_ISOLATED: "true",
    HML_REAL_INTEGRATIONS_ENABLED: "false",
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: "3101",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3307",
    DB_NAME: "j12_e2e_hml",
    DB_USER: "j12_e2e",
    DB_PASSWORD: "ephemeral-local-only",
    DB_USE_SSL: "false",
    JWT_SECRET: "local-only-jwt-secret-with-32-characters",
    E2E_BASE_URL: "http://127.0.0.1:3000",
    E2E_API_URL: "http://127.0.0.1:3101",
    VITE_API_URL: "http://127.0.0.1:3101",
    EMAIL_PROVIDER: "disabled",
    INTER_INTEGRATION_MODE: "disabled",
    ...overrides,
  };
}

test("accepts only the explicit isolated Sprint 23.11 profile", () => {
  const result = assertSprint2311Environment(safeEnv());
  assert.equal(result.ok, true);
  assert.equal(result.identity.database, "j12_e2e_hml");
  assert.equal(result.identity.externalIntegrationsEnabled, false);
});

test("rejects production and remote database targets", () => {
  const result = validateSprint2311Environment(
    safeEnv({ NODE_ENV: "production", DB_HOST: "db.example.com", DB_PORT: "3306" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /NODE_ENV/);
  assert.match(result.errors.join(" "), /DB_HOST/);
  assert.match(result.errors.join(" "), /DB_PORT/);
});

test("rejects real outbound credentials and certificate paths", () => {
  const result = validateSprint2311Environment(
    safeEnv({
      INTER_CLIENT_ID: "configured",
      INTER_CERT_PATH: "certs/inter.crt",
      N8N_WEBHOOK_URL: "https://n8n.example.com/hook",
      RESEND_API_KEY: "configured",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /INTER_CLIENT_ID/);
  assert.match(result.errors.join(" "), /INTER_CERT_PATH/);
  assert.match(result.errors.join(" "), /N8N_WEBHOOK_URL/);
  assert.match(result.errors.join(" "), /RESEND_API_KEY/);
});

test("rejects non-loopback browser and API URLs", () => {
  const result = validateSprint2311Environment(
    safeEnv({
      E2E_BASE_URL: "https://app.j12sports.com.br",
      E2E_API_URL: "https://api.j12sports.com.br",
      VITE_API_URL: "http://127.0.0.1:3001",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /E2E_BASE_URL/);
  assert.match(result.errors.join(" "), /E2E_API_URL/);
  assert.match(result.errors.join(" "), /VITE_API_URL must use port 3101/);
});
