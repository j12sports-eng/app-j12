const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../../..");

test("portal guards return 401 without a session and 403 for a disallowed role", async () => {
  const { requireAuth, requireRole } = require("../../../auth.js");

  const unauthenticated = await runMiddleware(requireAuth, { headers: {} });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await runMiddleware(requireRole(["aluno", "responsavel"]), {
    auth: { role: "professor" },
    user: { role: "professor" },
  });
  assert.equal(forbidden.statusCode, 403);

  const allowed = await runMiddleware(requireRole(["aluno", "responsavel"]), {
    auth: { role: "aluno" },
    user: { role: "aluno" },
  });
  assert.equal(allowed.nextCalled, true);
});

test("student portal ignores client-provided alunoId and uses authenticated scope", async () => {
  const source = await read("backend/routes/aluno-me.js");
  assert.match(source, /router\.use\(requireAuth\)/);
  assert.match(source, /router\.use\(requireRole\(\["aluno", "responsavel"\]\)\)/);
  assert.match(source, /resolveScopedStudentId\(req\.auth\)/);
  assert.doesNotMatch(source, /req\.(?:params|query|body)\.alunoId/);
});

test("responsible portal rejects an unlinked requested student before data access", async () => {
  const source = await read("backend/src/routes/responsaveis.routes.js");
  const membershipCheck = source.indexOf(
    "const student = students.find((item) => item.id === requestedStudentId)",
  );
  const forbidden = source.indexOf(
    'throw createHttpError("Aluno nao vinculado a este responsavel.", 403)',
  );
  assert.ok(membershipCheck > 0 && forbidden > membershipCheck);
  assert.match(source, /router\.use\(requireAuth\)/);
  assert.match(source, /assertResponsavel\(req\.auth\)/);
});

test("Pix creation authorizes the loaded charge before contacting Banco Inter", async () => {
  const route = await read("backend/src/routes/inter.routes.js");
  const pix = await read("backend/src/services/bancoInter/pix.js");
  const financial = await read("backend/src/services/bancoInter/financial.js");

  assert.match(route, /\["\/pix\/create", "\/api\/pix\/create"\],[\s\S]*?requireAuth/);
  assert.match(pix, /const charge = await loadChargeForPix/);
  assert.match(pix, /await assertPaymentAccess\(user, charge\)/);
  const createPixSource = pix.slice(
    pix.indexOf("async function createPixCharge"),
    pix.indexOf("async function getPixCharge"),
  );
  assert.ok(
    createPixSource.indexOf("await assertPaymentAccess(user, charge)") <
      createPixSource.indexOf("await interRequest("),
  );
  assert.match(financial, /role === "aluno" && userStudentId === normalizedStudentId/);
  assert.match(financial, /FROM j12_responsavel_alunos/);
  assert.match(financial, /FROM j12_alunos[\s\S]*responsavel_id/);
});

test("responsible hooks scope requests and discard stale dependent responses", async () => {
  for (const file of [
    "src/hooks/useDashboardResponsavel.ts",
    "src/hooks/useResponsavelFinanceiro.ts",
    "src/hooks/useResponsavelPresencas.ts",
    "src/hooks/useResponsavelContratos.ts",
    "src/hooks/useResponsavelNotificacoes.ts",
  ]) {
    const source = await read(file);
    assert.match(source, /selectedStudentId/);
    assert.match(source, /alunoId=\$\{encodeURIComponent\(studentId\)\}/);
    assert.match(source, /active = false/);
  }
});

function runMiddleware(middleware, request) {
  return new Promise((resolve, reject) => {
    const result = { nextCalled: false, statusCode: 200 };
    const response = {
      status(statusCode) {
        result.statusCode = statusCode;
        return this;
      },
      json(body) {
        result.body = body;
        resolve(result);
        return this;
      },
    };
    const next = (error) => {
      if (error) reject(error);
      else {
        result.nextCalled = true;
        resolve(result);
      }
    };
    Promise.resolve(middleware(request, response, next)).catch(reject);
  });
}

function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}
