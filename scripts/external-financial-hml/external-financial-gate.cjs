const fs = require("node:fs");
const path = require("node:path");
const { validateHmlEnvironment } = require("../hml/hml-core.cjs");

const PRODUCTION_HOSTS = new Set([
  "app.j12sports.com.br",
  "api.j12sports.com.br",
  "cdpj.partners.bancointer.com.br",
  "n8n.j12sports.com.br",
]);

const SCENARIOS = Object.freeze([
  "mtls-authentication",
  "pix-issuance-sandbox",
  "pix-query",
  "timeout",
  "retry",
  "idempotency",
  "webhook-valid",
  "webhook-invalid",
  "webhook-replay",
  "webhook-signature",
  "partial-payment",
  "amount-mismatch",
  "reconciliation",
  "duplicate",
  "provider-unavailable",
  "n8n",
  "audit",
]);

function buildOfflineAudit(env = process.env) {
  const isolation = validateIsolationOnly(env);
  return {
    externalCalls: false,
    mode: "OFFLINE_AUDIT",
    readyForExternalExecution: false,
    scenarios: SCENARIOS.map((id) => ({ id, status: "NOT_EXECUTED" })),
    blockers: [
      ...isolation.errors,
      "Authorized sandbox credentials were not inspected or used by offline audit.",
      "External execution requires a separately approved operational window.",
    ],
  };
}

function validateExternalAuthorization(env = process.env, options = {}) {
  const errors = [...validateIsolationOnly(env).errors];
  requireExact(env, "EXTERNAL_FINANCIAL_HML_ENABLED", "true", errors);
  requireExact(env, "EXTERNAL_FINANCIAL_NON_PRODUCTION_CONFIRMED", "true", errors);
  requireExact(env, "EXTERNAL_FINANCIAL_REAL_TRANSACTION_BLOCKED", "true", errors);
  const authorizationId = text(env.EXTERNAL_FINANCIAL_AUTHORIZATION_ID);
  if (!/^AUTH-HML-[A-Z0-9-]{8,80}$/.test(authorizationId))
    errors.push("EXTERNAL_FINANCIAL_AUTHORIZATION_ID must be an approved AUTH-HML-* identifier.");

  const allowedHosts = new Set(split(env.EXTERNAL_FINANCIAL_SANDBOX_HOSTS));
  if (allowedHosts.size === 0) errors.push("EXTERNAL_FINANCIAL_SANDBOX_HOSTS must be explicit.");
  validateSandboxUrl("INTER_BASE_URL", env.INTER_BASE_URL, allowedHosts, errors);
  validateSandboxUrl("N8N_BASE_URL", env.N8N_BASE_URL, allowedHosts, errors);

  for (const key of [
    "INTER_CLIENT_ID",
    "INTER_CLIENT_SECRET",
    "INTER_PIX_KEY",
    "INTER_WEBHOOK_SECRET",
    "N8N_SERVICE_TOKEN",
  ])
    requireSecret(env, key, errors);
  for (const key of ["INTER_CERT_PATH", "INTER_KEY_PATH"])
    validateCredentialFile(env[key], key, errors, options);

  const expected = `AUTHORIZE:${text(env.HML_INSTANCE_ID)}:${authorizationId}`;
  if (options.confirmation !== expected)
    errors.push(`Exact execution confirmation required: ${expected}`);

  return {
    authorizationId,
    errors,
    ok: errors.length === 0,
    sandboxHosts: [...allowedHosts],
  };
}

function assertExternalAuthorization(env, options) {
  const result = validateExternalAuthorization(env, options);
  if (!result.ok) {
    const error = new Error(result.errors.join(" "));
    error.code = "EXTERNAL_FINANCIAL_HML_NOT_AUTHORIZED";
    throw error;
  }
  return result;
}

function validateIsolationOnly(env) {
  const isolatedEnv = {
    ...env,
    HML_REAL_INTEGRATIONS_ENABLED: "false",
    EMAIL_PROVIDER: "disabled",
    INTER_INTEGRATION_MODE: "disabled",
    RESEND_API_KEY: "",
    BOTCONVERSA_WEBHOOK_URL: "",
    BOTCONVERSA_API_KEY: "",
    N8N_BASE_URL: "",
    N8N_WEBHOOK_URL: "",
    INTER_CLIENT_ID: "",
    INTER_CLIENT_SECRET: "",
    INTER_PIX_KEY: "",
  };
  const result = validateHmlEnvironment(isolatedEnv);
  return {
    ...result,
    errors: result.errors.filter((item) => !item.startsWith("N8N_BASE_URL is required")),
  };
}

function validateSandboxUrl(key, value, allowedHosts, errors) {
  try {
    const url = new URL(text(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") errors.push(`${key} must use HTTPS.`);
    if (PRODUCTION_HOSTS.has(host)) errors.push(`${key} points to a production host.`);
    if (!allowedHosts.has(host))
      errors.push(`${key} host is not in the explicit sandbox allowlist.`);
    if (!/(sandbox|hml|homolog|uat|test|invalid)/i.test(host))
      errors.push(`${key} host is not unmistakably non-production.`);
  } catch {
    errors.push(`${key} must be a valid sandbox URL.`);
  }
}

function validateCredentialFile(value, key, errors, options) {
  const candidate = text(value);
  if (!candidate || /^<.*>$/.test(candidate)) return errors.push(`${key} is required.`);
  const resolved = path.resolve(options.cwd || process.cwd(), candidate);
  if (options.checkFiles !== false && (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()))
    errors.push(`${key} does not reference an available sandbox credential file.`);
}
function requireSecret(env, key, errors) {
  const value = text(env[key]);
  if (!value || /^<.*>$/.test(value))
    errors.push(`${key} must come from the authorized secret store.`);
}
function requireExact(env, key, expected, errors) {
  if (text(env[key]).toLowerCase() !== expected) errors.push(`${key} must equal ${expected}.`);
}
function split(value) {
  return text(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
function text(value) {
  return String(value || "").trim();
}

module.exports = {
  SCENARIOS,
  assertExternalAuthorization,
  buildOfflineAudit,
  validateExternalAuthorization,
};
