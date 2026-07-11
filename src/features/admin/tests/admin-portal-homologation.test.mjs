import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const adminSurfaces = [
  ["dashboard", "src/routes/dashboard.tsx", "backend/src/routes/dashboard.routes.js"],
  ["alunos", "src/routes/alunos.tsx", "backend/src/routes/alunos.routes.js"],
  ["responsaveis", "src/lib/responsaveis-store.ts", "backend/src/routes/responsaveis.routes.js"],
  ["professores", "src/routes/professores.tsx", "backend/src/routes/professores.routes.js"],
  [
    "matriculas",
    "src/routes/admin/enrollments.tsx",
    "backend/src/domains/enrollments/presentation/routes/enrollment-admin.routes.js",
  ],
  ["turmas", "src/routes/turmas.tsx", "backend/src/routes/turmas.routes.js"],
  [
    "agenda",
    "src/routes/admin/agenda.tsx",
    "backend/src/domains/agenda/presentation/routes/agenda-admin.routes.js",
  ],
  ["presenca", "src/routes/presencas.tsx", "backend/src/routes/presencas.routes.js"],
  [
    "financeiro",
    "src/routes/admin/financeiro.tsx",
    "backend/src/domains/financeiro/presentation/routes/financial-admin.routes.js",
  ],
  [
    "quadras",
    "src/routes/admin/quadras.tsx",
    "backend/src/domains/quadras/presentation/routes/court-rental.routes.js",
  ],
  [
    "campeonatos",
    "src/routes/admin/campeonatos.tsx",
    "backend/src/domains/campeonatos/presentation/routes/championship-admin.routes.js",
  ],
  [
    "bi",
    "src/routes/admin/bi.tsx",
    "backend/src/domains/bi/presentation/routes/bi-admin.routes.js",
  ],
];

test("critical admin surfaces have frontend and backend entrypoints", () => {
  for (const [name, frontend, backend] of adminSurfaces) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, frontend)),
      true,
      `${name}: frontend ausente`,
    );
    assert.equal(fs.existsSync(path.join(projectRoot, backend)), true, `${name}: backend ausente`);
  }
});

test("canonical composition root mounts critical modern admin routers", () => {
  const server = read("backend/src/server.js");
  for (const mount of [
    "enrollmentAdminRoutes",
    "financialAdminRoutes",
    "agendaAdminRoutes",
    "courtRentalRoutes",
    "championshipAdminRoutes",
    "biAdminRoutes",
  ]) {
    assert.match(server, new RegExp(`mount\\([\\s\\S]*?${mount},?\\s*\\)`), `${mount} nao montado`);
  }
});

test("production settings store does not import mock datasets", () => {
  const store = read("src/lib/settings/settings-store.ts");
  const trialStore = read("src/lib/trial-classes-store.ts");

  assert.doesNotMatch(store, /settings\/mocks|settingsMock|usersMock/);
  assert.doesNotMatch(trialStore, /trialClassesMock[^\"']/);
  assert.match(trialStore, /seedData\(\)[\s\S]*return \[\]/);
});

test("external financial actions remain behind explicit admin APIs", () => {
  const interRoutes = read(
    "backend/src/domains/financeiro/inter/presentation/routes/inter-admin.routes.js",
  );
  const paymentRoutes = read(
    "backend/src/domains/financeiro/payment/presentation/routes/payment-admin.routes.js",
  );

  assert.match(interRoutes, /canManageSystem/);
  assert.match(paymentRoutes, /canManageSystem/);
});
