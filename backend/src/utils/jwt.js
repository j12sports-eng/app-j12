const { createHmac, timingSafeEqual } = require("node:crypto");

const JWT_ALGORITHM = "HS256";
const JWT_CANONICAL_SECRET_ENV_NAME = "JWT_SECRET";
const JWT_LEGACY_SECRET_ENV_NAMES = ["AUTH_JWT_SECRET", "APP_JWT_SECRET", "SESSION_SECRET"];
const JWT_EXPIRES_ENV_NAMES = ["JWT_EXPIRES", "JWT_EXPIRES_IN", "JWT_EXPIRES_IN_SECONDS"];
const UNSAFE_SECRET_PATTERNS = [
  /^(change|replace)[-_ ]?me$/i,
  /^(your|example|dummy|fake|test)[-_ ]?(jwt[-_ ]?)?secret$/i,
  /^troque[-_ ]?este[-_ ]?segredo$/i,
  /^<.*(?:example|not[-_ ]a[-_ ]real|configure).*>$/i,
  /^secret$/i,
];

function createJwtConfigError(message, code) {
  const error = new Error(message);
  error.statusCode = 500;
  error.code = code;
  error.expose = true;
  return error;
}

function base64UrlEncode(value) {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function getJwtSecret() {
  const secret = process.env[JWT_CANONICAL_SECRET_ENV_NAME];

  if (!String(secret || "").trim()) {
    throw createJwtConfigError("JWT_SECRET nao configurado.", "JWT_SECRET_MISSING");
  }

  const normalized = String(secret).trim();
  if (UNSAFE_SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw createJwtConfigError("JWT_SECRET possui placeholder inseguro.", "JWT_SECRET_INVALID");
  }

  // Aliases antigos nao selecionam mais o segredo. Se ainda estiverem presentes,
  // precisam coincidir com a fonte canonica para evitar rotacao parcial silenciosa.
  const hasConflictingLegacySecret = JWT_LEGACY_SECRET_ENV_NAMES.some((name) => {
    const legacySecret = process.env[name];
    return String(legacySecret || "").trim() && String(legacySecret).trim() !== normalized;
  });

  if (hasConflictingLegacySecret) {
    throw createJwtConfigError(
      "Configuracao JWT ambigua: aliases legados divergem de JWT_SECRET.",
      "JWT_SECRET_CONFLICT",
    );
  }

  return normalized;
}

function parseDurationSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return NaN;

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const match = normalized.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return NaN;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return amount * multipliers[unit];
}

function getJwtExpiresInSeconds(options = {}) {
  const configured =
    options.expiresInSeconds ??
    options.expiresIn ??
    JWT_EXPIRES_ENV_NAMES.map((name) => process.env[name]).find((value) =>
      String(value || "").trim(),
    );

  if (configured == null || String(configured).trim() === "") {
    throw createJwtConfigError(
      "JWT_EXPIRES/JWT_EXPIRES_IN/JWT_EXPIRES_IN_SECONDS nao configurado.",
      "JWT_EXPIRES_MISSING",
    );
  }

  const seconds = parseDurationSeconds(configured);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw createJwtConfigError(
      "JWT_EXPIRES invalido. Use segundos ou sufixos s, m, h, d.",
      "JWT_EXPIRES_INVALID",
    );
  }

  return seconds;
}

function signJwt(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = getJwtExpiresInSeconds(options);
  const secret = getJwtSecret();
  const header = {
    alg: JWT_ALGORITHM,
    typ: "JWT",
  };
  const body = {
    iat: now,
    ...payload,
  };

  if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    body.exp = now + expiresInSeconds;
  }

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(body);
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");

  return `${content}.${signature}`;
}

function verifyJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    const error = new Error("Token invalido.");
    error.code = "JWT_MALFORMED";
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const content = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", getJwtSecret()).update(content).digest();
  const receivedSignature = Buffer.from(encodedSignature, "base64url");

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    const error = new Error("Token invalido.");
    error.code = "JWT_INVALID_SIGNATURE";
    throw error;
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader));
  if (header?.alg !== JWT_ALGORITHM) {
    const error = new Error("Token invalido.");
    error.code = "JWT_UNSUPPORTED_ALG";
    throw error;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && Number(payload.exp) <= now) {
    const error = new Error("Token expirado.");
    error.code = "JWT_EXPIRED";
    throw error;
  }

  return payload;
}

module.exports = {
  signJwt,
  verifyJwt,
};
