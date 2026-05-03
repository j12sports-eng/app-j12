const { createHmac, timingSafeEqual } = require("node:crypto");

const JWT_ALGORITHM = "HS256";

function base64UrlEncode(value) {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function getJwtSecret() {
  return String(
    process.env.JWT_SECRET ||
      process.env.AUTH_JWT_SECRET ||
      process.env.APP_JWT_SECRET ||
      process.env.SESSION_SECRET ||
      process.env.DB_PASSWORD ||
      "j12-local-secret",
  );
}

function signJwt(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = Number(
    options.expiresInSeconds || process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 30,
  );
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
