import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("automation history frontend is GET-only and uses stable query keys", () => {
  const api = read("api/financial-automation-history.api.ts");
  const hooks = read("hooks/useAutomationHistory.ts");
  assert.match(api, /api\.get/);
  assert.match(api, /\/admin\/financeiro\/automacoes\/historico/);
  assert.match(api, /execution\/\$\{encodeURIComponent\(executionId\)\}/);
  assert.doesNotMatch(api, /api\.(post|put|patch|del|delete)/);
  assert.match(hooks, /automationHistoryKeys\.list\(filters\)/);
  assert.match(hooks, /enabled: Boolean\(historyId\)/);
  assert.match(hooks, /enabled: Boolean\(executionId\)/);
  assert.doesNotMatch(hooks, /refetchInterval|useMutation/);
});

test("page provides filters, pagination, states, details and timeline", () => {
  const page = read("pages/FinancialAutomationHistoryPage.tsx");
  const route = read("../../routes/admin/financeiro.automacoes.historico.tsx");
  const filters = read("components/AutomationHistoryFilters.tsx");
  const details = read("components/AutomationHistoryDetailsDialog.tsx");
  assert.match(page, /Carregando historico/);
  assert.match(page, /Nenhuma|AutomationHistoryTable/);
  assert.match(page, /hasPrevious/);
  assert.match(page, /AutomationHistoryDetailsDialog/);
  assert.match(route, /\/admin\/financeiro\/automacoes\/historico/);
  assert.match(filters, /correlationId/);
  assert.match(filters, /triggerType/);
  assert.match(filters, /sortBy/);
  assert.match(filters, /sortDirection/);
  assert.match(details, /useAutomationHistoryDetails/);
  assert.match(details, /useExecutionHistory/);
});

test("navigation exposes the protected administrative history route", () => {
  const sidebar = read("../../components/AppSidebar.tsx");
  const routeTree = read("../../routeTree.gen.ts");
  assert.match(sidebar, /Historico de Automacoes/);
  assert.match(sidebar, /roles: \["admin", "coordenador"\]/);
  assert.match(routeTree, /\/admin\/financeiro\/automacoes\/historico/);
});
