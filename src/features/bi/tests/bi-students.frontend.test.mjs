import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(feature, "..", "..");
test("students API uses shared client and foundation filters", async () => {
  const api = await readFile(path.join(feature, "api", "bi-students.api.ts"), "utf8");
  assert.match(api, /import \{ api \} from "@\/lib\/api"/);
  assert.match(api, /\/admin\/bi\/students/);
  for (const filter of ["period", "startDate", "endDate", "unitId"])
    assert.match(api, new RegExp(filter));
  assert.doesNotMatch(api, /axios|fetch\(/);
});
test("students hook has stable TanStack Query key", async () => {
  const hook = await readFile(path.join(feature, "hooks", "useBiStudents.ts"), "utf8");
  const keys = await readFile(path.join(feature, "query-keys", "bi-query-keys.ts"), "utf8");
  assert.match(hook, /useQuery/);
  assert.match(hook, /biQueryKeys\.students/);
  assert.match(keys, /"students"/);
});
test("students UI handles KPIs, entries, unavailable exits, distributions and states", async () => {
  const page = await readFile(path.join(feature, "components", "BiStudentsDashboard.tsx"), "utf8");
  for (const value of [
    "isLoading",
    "isError",
    "Sem dados agregados",
    "Entradas mensais",
    "Saidas indisponiveis",
    "Alunos por faixa etaria",
    "Alunos por modalidade",
    "Alunos por unidade",
    "CUSTOM",
  ])
    assert.match(page, new RegExp(value));
  assert.doesNotMatch(page, /cpf|email|telefone|dataNascimento|data_nascimento/i);
});
test("students BI route is protected and legacy dashboard remains isolated", async () => {
  const route = await readFile(path.join(source, "routes", "admin", "bi.alunos.tsx"), "utf8");
  const sidebar = await readFile(path.join(source, "components", "AppSidebar.tsx"), "utf8");
  const legacy = await readFile(path.join(source, "routes", "dashboard.tsx"), "utf8");
  assert.match(route, /\/admin\/bi\/alunos/);
  assert.match(route, /admin.*coordenador|coordenador.*admin/);
  assert.match(sidebar, /BI de Alunos/);
  assert.doesNotMatch(legacy, /BiStudentsDashboard/);
});
