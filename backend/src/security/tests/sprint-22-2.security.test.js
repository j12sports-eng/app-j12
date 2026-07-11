const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../../..");

test("PM2 production and HML use the canonical modern composition root", async () => {
  for (const file of ["ecosystem.config.cjs", "ecosystem.hml.config.cjs"]) {
    const source = await read(file);
    assert.match(source, /script:\s*"backend\/server\.js"/);
    assert.doesNotMatch(source, /script:\s*"server\/index\.mjs"/);
  }
  const server = await read("backend/src/server.js");
  for (const mount of [
    "enrollmentAdminRoutes",
    "financialAdminRoutes",
    "agendaAdminRoutes",
    "courtRentalRoutes",
    "championshipAdminRoutes",
    "championshipPublicRoutes",
    "biAdminRoutes",
    "notificationRoutes",
  ]) {
    assert.match(server, new RegExp(mount));
  }
});

test("password recovery is enumeration-safe and never exposes reset token in production", async () => {
  const source = await read("backend/routes/auth.js");
  assert.match(source, /Se o usuario existir/);
  assert.match(source, /process\.env\.NODE_ENV !== "production" && reset/);
  assert.doesNotMatch(source, /Nao encontramos um usuario com esse identificador/);
  assert.match(source, /router\.post\("\/login", authRateLimit/);
  assert.match(source, /router\.post\("\/forgot-password", authRateLimit/);
  assert.match(source, /router\.post\("\/reset-password", authRateLimit/);
});

test("professor directory requires management authorization before private reads", async () => {
  const source = await read("backend/src/routes/professores.routes.js");
  const guard = source.indexOf("router.use((req, res, next)");
  const list = source.indexOf('router.get("/"');
  assert.ok(guard > 0 && guard < list);
  assert.match(source, /canManageSystem\(req\.auth\)/);
  assert.match(source, /status\(403\)/);
});

test("professor attendance checks class and student ownership", async () => {
  const source = await read("backend/src/routes/presencas.routes.js");
  assert.match(source, /assertTeacherCanAccessClass/);
  assert.match(source, /assertTeacherCanAccessStudent/);
  assert.match(source, /turma\.professor_id = \?/);
  assert.match(source, /link\.status = 'ACTIVE'/);
  assert.match(source, /Aluno fora do escopo do professor/);
  assert.match(source, /Turma fora do escopo do professor/);
});

test("JWT fixes HS256, validates expiry and rejects invalid signature", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousExpiry = process.env.JWT_EXPIRES;
  process.env.JWT_SECRET = "test-only-secret-with-adequate-length";
  process.env.JWT_EXPIRES = "1h";
  const { signJwt, verifyJwt } = require("../../utils/jwt.js");
  const token = signJwt({ sub: "user-1" });
  assert.equal(verifyJwt(token).sub, "user-1");
  assert.throws(() => verifyJwt(`${token.slice(0, -1)}x`), /Token invalido/);
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  if (previousExpiry === undefined) delete process.env.JWT_EXPIRES;
  else process.env.JWT_EXPIRES = previousExpiry;
});

function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}
