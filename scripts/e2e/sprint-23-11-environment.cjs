const { URL } = require("node:url");

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const EMPTY_WHEN_DISABLED = [
  "INTER_CLIENT_ID",
  "INTER_CLIENT_SECRET",
  "INTER_PIX_KEY",
  "INTER_PIX_CHAVE",
  "INTER_CERT_PATH",
  "INTER_KEY_PATH",
  "N8N_BASE_URL",
  "N8N_WEBHOOK_URL",
  "N8N_SERVICE_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "BOTCONVERSA_WEBHOOK_URL",
  "BOTCONVERSA_API_URL",
  "BOTCONVERSA_API_KEY",
  "BOTCONVERSA_TOKEN",
];

function validateSprint2311Environment(env = process.env) {
  const errors = [];

  exact(env, "J12_ENVIRONMENT", "e2e-local", errors);
  exact(env, "HML_ISOLATED", "true", errors);
  exact(env, "HML_REAL_INTEGRATIONS_ENABLED", "false", errors);
  exact(env, "DB_HOST", "127.0.0.1", errors);
  exact(env, "DB_PORT", "3307", errors);
  exact(env, "DB_NAME", "j12_e2e_hml", errors);
  exact(env, "HOST", "127.0.0.1", errors);
  exact(env, "PORT", "3101", errors);
  exact(env, "EMAIL_PROVIDER", "disabled", errors);
  exact(env, "INTER_INTEGRATION_MODE", "disabled", errors);

  const nodeEnvironment = text(env.NODE_ENV).toLowerCase();
  if (nodeEnvironment === "production") {
    errors.push("NODE_ENV must not be production for browser E2E.");
  }
  if (!new Set(["development", "test"]).has(nodeEnvironment)) {
    errors.push("NODE_ENV must be development or test for browser E2E.");
  }
  if (!text(env.DB_USER)) errors.push("DB_USER is required for the disposable database.");
  if (!text(env.DB_PASSWORD)) errors.push("DB_PASSWORD is required and must remain outside Git.");
  if (!text(env.JWT_SECRET) || text(env.JWT_SECRET).length < 32) {
    errors.push("JWT_SECRET must contain at least 32 characters and remain outside Git.");
  }
  if (text(env.DB_USE_SSL).toLowerCase() === "true") {
    errors.push("DB_USE_SSL must be false for the loopback disposable database.");
  }

  validateLoopbackUrl("E2E_BASE_URL", env.E2E_BASE_URL, 3000, errors);
  validateLoopbackUrl("E2E_API_URL", env.E2E_API_URL, 3101, errors);
  validateLoopbackUrl("VITE_API_URL", env.VITE_API_URL, 3101, errors);

  for (const key of EMPTY_WHEN_DISABLED) {
    if (text(env[key])) errors.push(`${key} must be empty during isolated browser E2E.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    identity: {
      environment: text(env.J12_ENVIRONMENT),
      database: text(env.DB_NAME),
      databaseHost: text(env.DB_HOST),
      databasePort: Number(env.DB_PORT),
      apiUrl: text(env.E2E_API_URL),
      baseUrl: text(env.E2E_BASE_URL),
      externalIntegrationsEnabled: false,
    },
  };
}

function assertSprint2311Environment(env = process.env) {
  const result = validateSprint2311Environment(env);
  if (!result.ok) {
    const error = new Error(result.errors.join(" "));
    error.code = "SPRINT_23_11_ENVIRONMENT_UNSAFE";
    throw error;
  }
  return result;
}

function validateLoopbackUrl(key, value, expectedPort, errors) {
  const raw = text(value);
  if (!raw) {
    errors.push(`${key} is required.`);
    return;
  }
  try {
    const url = new URL(raw);
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
      errors.push(`${key} must use HTTP on loopback.`);
    }
    if (port !== expectedPort) errors.push(`${key} must use port ${expectedPort}.`);
    if (url.username || url.password) errors.push(`${key} must not embed credentials.`);
  } catch {
    errors.push(`${key} must be a valid URL.`);
  }
}

function exact(env, key, expected, errors) {
  if (text(env[key]).toLowerCase() !== expected.toLowerCase()) {
    errors.push(`${key} must equal ${expected}.`);
  }
}

function text(value) {
  return String(value ?? "").trim();
}

module.exports = {
  EMPTY_WHEN_DISABLED,
  assertSprint2311Environment,
  validateSprint2311Environment,
};
