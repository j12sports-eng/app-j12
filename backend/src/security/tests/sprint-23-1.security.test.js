const assert = require("node:assert/strict");
const test = require("node:test");
const { signJwt, verifyJwt } = require("../../utils/jwt.js");
const {
  INTER_MTLS_INVALID_CODE,
  MTLSService,
} = require("../../domains/financeiro/payment/providers/inter/services/mtls.service.js");
const {
  INTER_OAUTH_CREDENTIALS_MISSING_CODE,
  OAuthService,
} = require("../../domains/financeiro/payment/providers/inter/services/oauth.service.js");
const JWT_ENV_NAMES = ["JWT_SECRET", "AUTH_JWT_SECRET", "APP_JWT_SECRET", "SESSION_SECRET"];
function withJwtEnv(values, callback) {
  const previous = Object.fromEntries(JWT_ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of JWT_ENV_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return callback();
  } finally {
    for (const name of JWT_ENV_NAMES) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}
test("JWT falha fechado sem secret", () =>
  withJwtEnv({}, () =>
    assert.throws(
      () => signJwt({ sub: "aluno-falso" }, { expiresIn: "5m" }),
      (e) => e.code === "JWT_SECRET_MISSING" && !e.message.includes("aluno-falso"),
    ),
  ));
test("JWT rejeita placeholder inseguro", () =>
  withJwtEnv({ JWT_SECRET: "change-me" }, () =>
    assert.throws(
      () => signJwt({ sub: "teste" }, { expiresIn: "5m" }),
      (e) => e.code === "JWT_SECRET_INVALID" && !e.message.includes("change-me"),
    ),
  ));
test("JWT funciona com fixture falsa forte", () =>
  withJwtEnv({ JWT_SECRET: "fixture-only-not-a-real-secret-23-1" }, () => {
    const token = signJwt({ sub: "fixture-user" }, { expiresIn: "5m" });
    assert.equal(verifyJwt(token).sub, "fixture-user");
  }));
test("OAuth Inter falha fechado sem credenciais", async () => {
  const oauth = new OAuthService({ clientId: "", clientSecret: "" });
  await assert.rejects(
    oauth.getAccessToken(),
    (e) => e.code === INTER_OAUTH_CREDENTIALS_MISSING_CODE,
  );
});
test("mTLS nao permite desativar rejectUnauthorized", () =>
  assert.throws(
    () => new MTLSService({ rejectUnauthorized: false }),
    (e) => e.code === INTER_MTLS_INVALID_CODE,
  ));
test("mTLS rejeita conteudo invalido sem expo-lo", () => {
  const value = "fixture-invalid-sensitive-content";
  const fs = {
    existsSync: () => true,
    readFileSync: () => Buffer.from(value),
    statSync: () => ({ isFile: () => true }),
  };
  const mtls = new MTLSService({
    env: { INTER_CERT_PATH: "fixture.crt", INTER_KEY_PATH: "fixture.key" },
    fs,
  });
  assert.throws(
    () => mtls.createHttpsAgent(),
    (e) => e.code === INTER_MTLS_INVALID_CODE && !e.message.includes(value),
  );
});
