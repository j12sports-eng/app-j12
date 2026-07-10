import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(feature, "..", "..");

test("financial BI API uses shared client, endpoint and foundation filters", async () => {
  const api = await readFile(path.join(feature, "api", "bi-financial.api.ts"), "utf8");
  assert.match(api, /import \{ api \} from "@\/lib\/api"/);
  assert.match(api, /\/admin\/bi\/financial/);
  for (const filter of ["period", "startDate", "endDate", "unitId"])
    assert.match(api, new RegExp(filter));
  assert.doesNotMatch(api, /axios|fetch\(|token|certificate|credential/i);
});
test("financial BI hook and query key use TanStack Query", async () => {
  const hook = await readFile(path.join(feature, "hooks", "useBiFinancial.ts"), "utf8");
  const keys = await readFile(path.join(feature, "query-keys", "bi-query-keys.ts"), "utf8");
  assert.match(hook, /useQuery/);
  assert.match(hook, /biQueryKeys\.financial/);
  assert.match(keys, /"financial"/);
});
test("financial UI has KPIs, real charts, breakdowns and all request states", async () => {
  const page = await readFile(path.join(feature, "components", "BiFinancialDashboard.tsx"), "utf8");
  for (const value of [
    "isLoading",
    "isError",
    "Sem dados reais",
    "AreaChart",
    "PieChart",
    "Receita por categoria",
    "Receita por modalidade",
    "Receita por unidade",
    "Meios de pagamento",
    "CUSTOM",
  ])
    assert.match(page, new RegExp(value));
  assert.doesNotMatch(page, /pix_payload|pixCopyPaste|qr_code|e2eid|credential|certificate/i);
});
test("financial BI route and protected navigation are isolated from legacy dashboard", async () => {
  const route = await readFile(path.join(source, "routes", "admin", "bi.financeiro.tsx"), "utf8");
  const sidebar = await readFile(path.join(source, "components", "AppSidebar.tsx"), "utf8");
  const legacy = await readFile(path.join(source, "routes", "dashboard.tsx"), "utf8");
  assert.match(route, /\/admin\/bi\/financeiro/);
  assert.match(route, /admin.*coordenador|coordenador.*admin/);
  assert.match(sidebar, /BI Financeiro/);
  assert.doesNotMatch(legacy, /BiFinancialDashboard/);
});
