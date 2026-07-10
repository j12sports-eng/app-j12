import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(feature, "..", "..");
test("classes API and hook use shared BI infrastructure", async () => {
  const api = await readFile(path.join(feature, "api", "bi-classes.api.ts"), "utf8");
  const hook = await readFile(path.join(feature, "hooks", "useBiClasses.ts"), "utf8");
  assert.match(api, /@\/lib\/api/);
  assert.match(api, /\/admin\/bi\/classes/);
  assert.doesNotMatch(api, /fetch\(|axios/);
  assert.match(hook, /useQuery/);
  assert.match(hook, /biQueryKeys\.classes/);
});
test("classes dashboard exposes KPIs ranking critical classes vacancies filters and table", async () => {
  const page = await readFile(path.join(feature, "components", "BiClassesDashboard.tsx"), "utf8");
  for (const value of [
    "Turmas ativas",
    "Taxa de ocupacao",
    "Vagas disponiveis",
    "Ocupacao por unidade",
    "Turmas criticas",
    "Tabela operacional",
    "Unidade",
    "Categoria",
    "Indisponivel",
  ])
    assert.match(page, new RegExp(value));
});
test("classes route and sidebar remain administrative", async () => {
  const route = await readFile(path.join(source, "routes", "admin", "bi.turmas.tsx"), "utf8");
  const sidebar = await readFile(path.join(source, "components", "AppSidebar.tsx"), "utf8");
  assert.match(route, /admin.*coordenador|coordenador.*admin/);
  assert.match(sidebar, /BI de Turmas/);
});
