const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../../..");
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

function source(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function fixtureSecret(label) {
  return "fixture-only-not-a-real-secret-" + label + "-23-1e";
}

test("JWT_SECRET canonico e obrigatorio mesmo quando alias legado existe", () => {
  const { signJwt } = require("../../utils/jwt.js");
  withJwtEnv({ AUTH_JWT_SECRET: fixtureSecret("legacy") }, () => {
    assert.throws(
      () => signJwt({ sub: "fixture-user" }, { expiresIn: "1h" }),
      (error) =>
        error.code === "JWT_SECRET_MISSING" && !error.message.includes(fixtureSecret("legacy")),
    );
  });
});

test("ausencia total e placeholder inseguro falham sem expor o valor", () => {
  const { signJwt } = require("../../utils/jwt.js");
  withJwtEnv({}, () => {
    assert.throws(
      () => signJwt({ sub: "fixture-user" }, { expiresIn: "1h" }),
      (error) => error.code === "JWT_SECRET_MISSING",
    );
  });

  const placeholder = "change-me";
  withJwtEnv({ JWT_SECRET: placeholder }, () => {
    assert.throws(
      () => signJwt({ sub: "fixture-user" }, { expiresIn: "1h" }),
      (error) => error.code === "JWT_SECRET_INVALID" && !error.message.includes(placeholder),
    );
  });
});

test("alias legado igual ao canonico preserva compatibilidade explicita", () => {
  const { signJwt, verifyJwt } = require("../../utils/jwt.js");
  const secret = fixtureSecret("same");
  withJwtEnv({ JWT_SECRET: secret, AUTH_JWT_SECRET: secret }, () => {
    const token = signJwt({ sub: "fixture-user" }, { expiresIn: "1h" });
    assert.equal(verifyJwt(token).sub, "fixture-user");
  });
});

test("alias legado divergente falha fechado sem expor secrets", () => {
  const { signJwt } = require("../../utils/jwt.js");
  const canonical = fixtureSecret("canonical");
  const legacy = fixtureSecret("divergent");
  withJwtEnv({ JWT_SECRET: canonical, SESSION_SECRET: legacy }, () => {
    assert.throws(
      () => signJwt({ sub: "fixture-user" }, { expiresIn: "1h" }),
      (error) =>
        error.code === "JWT_SECRET_CONFLICT" &&
        !error.message.includes(canonical) &&
        !error.message.includes(legacy),
    );
  });
});

test("JWT expirado, assinatura invalida e algoritmo invalido sao rejeitados", () => {
  const { signJwt, verifyJwt } = require("../../utils/jwt.js");
  const secret = fixtureSecret("validation");
  withJwtEnv({ JWT_SECRET: secret }, () => {
    const originalNow = Date.now;
    try {
      Date.now = () => 0;
      const expired = signJwt({ sub: "fixture-user" }, { expiresIn: "1s" });
      Date.now = () => 2000;
      assert.throws(
        () => verifyJwt(expired),
        (error) => error.code === "JWT_EXPIRED",
      );
    } finally {
      Date.now = originalNow;
    }

    const valid = signJwt({ sub: "fixture-user" }, { expiresIn: "1h" });
    const parts = valid.split(".");
    const tamperedSignature = Buffer.from(parts[2], "base64url");
    tamperedSignature[0] ^= 0xff;
    const invalidSignature =
      parts[0] + "." + parts[1] + "." + tamperedSignature.toString("base64url");
    assert.throws(
      () => verifyJwt(invalidSignature),
      (error) => error.code === "JWT_INVALID_SIGNATURE",
    );

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const contentToSign = header + "." + parts[1];
    const signature = createHmac("sha256", secret).update(contentToSign).digest("base64url");
    assert.throws(
      () => verifyJwt(contentToSign + "." + signature),
      (error) => error.code === "JWT_UNSUPPORTED_ALG",
    );
  });
});

test("emissor legado e validadores usam infraestrutura JWT canonica", () => {
  const legacyEmitter = source("backend/src/routes/auth.routes.js");
  assert.match(legacyEmitter, /signJwt/);
  assert.doesNotMatch(legacyEmitter, /jsonwebtoken|jwt.sign/);

  for (const file of ["backend/src/routes/portalAlunoPresencas.js", "server/routes/aluno.mjs"]) {
    const route = source(file);
    assert.match(route, /verifyJwt/);
    assert.doesNotMatch(route, /process.env.JWT_SECRET|jwt.verify/);
  }
});

test("seeds operacionais exigem opt-in e passwords externas", () => {
  for (const file of ["backend/auth.js", "server/database.mjs"]) {
    const value = source(file);
    assert.match(value, /AUTH_SEED_ENABLED/);
    assert.match(value, /String\(env\.AUTH_SEED_ENABLED \|\| ""\)[\s\S]*=== "true"/);
    assert.match(value, /if \(!isAuthSeedEnabled\(\)\) return;/);
    for (const role of ["admin", "coordenador", "professor", "aluno", "responsavel"]) {
      assert.match(value, new RegExp(role + ': "AUTH_SEED_[A-Z]+_PASSWORD"'));
      assert.match(value, new RegExp('getAuthSeedPassword\\("' + role + '"\\)'));
    }
    assert.match(value, /password\.length < 16/);
    assert.match(value, /change\|replace\|configure\|example\|dummy\|fake\|test\|placeholder/i);
    assert.doesNotMatch(value, /password:\s*["'][^"']+["']/);
  }
});

test("documentos e exemplos atuais usam somente marcadores explicitamente falsos", () => {
  for (const file of ["CONEXAO_MYSQL_CORRIGIDA.md", "RELATORIO_FINAL.md"]) {
    const document = source(file);
    assert.match(document, /<REDACTED_HISTORICAL_SECRET>/);
  }
  assert.match(source("VISUALIZACAO_SOLUCAO.md"), /<EXAMPLE_ONLY_NOT_A_REAL_SECRET>/);

  for (const file of [".env.example", ".env.api.production.example", "backend/.env.example"]) {
    const example = source(file);
    assert.match(example, /^AUTH_SEED_ENABLED=false$/m);
    assert.match(example, /^JWT_SECRET=<EXAMPLE_ONLY_NOT_A_REAL_SECRET>$/m);
    for (const role of ["ADMIN", "COORDENADOR", "PROFESSOR", "ALUNO", "RESPONSAVEL"]) {
      assert.match(
        example,
        new RegExp("^AUTH_SEED_" + role + "_PASSWORD=<EXAMPLE_ONLY_NOT_A_REAL_PASSWORD>$", "m"),
      );
    }
  }
});

test("preflights exigem JWT_SECRET canonico sem aceitar aliases como substitutos", () => {
  for (const file of ["backend/routes/auth.js", "server/index.mjs"]) {
    const value = source(file);
    assert.match(value, /hasEnv\("JWT_SECRET"\)/);
    assert.doesNotMatch(value, /hasEnv\("(?:AUTH_JWT_SECRET|APP_JWT_SECRET|SESSION_SECRET)"\)/);
  }
});
