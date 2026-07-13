const { spawn } = require("node:child_process");
const { URL } = require("node:url");

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const PRODUCTION_HOSTS = new Set([
  "app.j12sports.com.br",
  "api.j12sports.com.br",
  "cdpj.partners.bancointer.com.br",
]);

function validateHmlEnvironment(env = process.env) {
  const errors = [];
  requireExact(env, "J12_ENVIRONMENT", "hml", errors);
  requireExact(env, "HML_ISOLATED", "true", errors);
  requireExact(env, "HML_REAL_INTEGRATIONS_ENABLED", "false", errors);
  if (!/^hml-[a-z0-9-]+$/.test(text(env.HML_INSTANCE_ID)))
    errors.push(
      "HML_INSTANCE_ID must start with hml- and contain only lowercase letters, digits or hyphens.",
    );
  if (!/(_hml|_homolog(?:ation)?)$/i.test(text(env.DB_NAME)))
    errors.push("DB_NAME must end in _hml, _homolog or _homologation.");
  if (!LOOPBACK_HOSTS.has(text(env.DB_HOST).toLowerCase()))
    errors.push("DB_HOST must be loopback for the disposable HML profile.");
  if (text(env.EMAIL_PROVIDER).toLowerCase() !== "disabled")
    errors.push("EMAIL_PROVIDER must be disabled.");
  if (text(env.INTER_INTEGRATION_MODE).toLowerCase() !== "disabled")
    errors.push("INTER_INTEGRATION_MODE must be disabled.");
  for (const key of [
    "RESEND_API_KEY",
    "BOTCONVERSA_WEBHOOK_URL",
    "BOTCONVERSA_API_KEY",
    "N8N_BASE_URL",
    "N8N_WEBHOOK_URL",
    "INTER_CLIENT_ID",
    "INTER_CLIENT_SECRET",
    "INTER_PIX_KEY",
  ])
    if (text(env[key])) errors.push(`${key} must be empty while real integrations are disabled.`);
  for (const key of [
    "HML_PUBLIC_URL",
    "HML_API_URL",
    "CORS_ORIGIN",
    "APP_BASE_URL",
    "INTER_BASE_URL",
    "INTER_WEBHOOK_URL",
  ])
    validateUrl(key, env[key], errors);
  for (const key of ["DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "JWT_SECRET", "INTER_WEBHOOK_SECRET"])
    if (!text(env[key]) || /^<.*>$/.test(text(env[key])))
      errors.push(`${key} must be supplied by the secret store, not by the template.`);
  if (text(env.JWT_SECRET).length < 32 && !/^<.*>$/.test(text(env.JWT_SECRET)))
    errors.push("JWT_SECRET must contain at least 32 characters.");
  return {
    ok: errors.length === 0,
    errors,
    environment: "hml",
    instanceId: text(env.HML_INSTANCE_ID),
    database: text(env.DB_NAME),
  };
}

function assertValidHmlEnvironment(env = process.env) {
  const result = validateHmlEnvironment(env);
  if (!result.ok) throw controlledError(result.errors.join(" "), "HML_ENVIRONMENT_UNSAFE");
  return result;
}

function assertResetConfirmation(env, confirmation) {
  const validated = assertValidHmlEnvironment(env);
  const expected = `RESET:${validated.instanceId}:${validated.database}`;
  if (confirmation !== expected)
    throw controlledError(
      `Reset refused. Exact confirmation required: ${expected}`,
      "HML_RESET_CONFIRMATION_REQUIRED",
    );
  return validated;
}

function assertLocalHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))
    throw controlledError("Smoke target must use HTTP on loopback.", "HML_SMOKE_TARGET_UNSAFE");
  return url;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(controlledError(`${command} exited with ${code}.`, "HML_COMMAND_FAILED")),
    );
  });
}

function validateUrl(key, value, errors) {
  if (!text(value)) return errors.push(`${key} is required.`);
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      PRODUCTION_HOSTS.has(hostname) ||
      (hostname.endsWith(".app.j12sports.com.br") && hostname !== "hml.app.j12sports.com.br")
    )
      errors.push(`${key} points to a production host.`);
  } catch {
    errors.push(`${key} must be a valid URL.`);
  }
}
function requireExact(env, key, expected, errors) {
  if (text(env[key]).toLowerCase() !== expected) errors.push(`${key} must equal ${expected}.`);
}
function text(value) {
  return String(value || "").trim();
}
function controlledError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  assertLocalHttpUrl,
  assertResetConfirmation,
  assertValidHmlEnvironment,
  run,
  validateHmlEnvironment,
};
