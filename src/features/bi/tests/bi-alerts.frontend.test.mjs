import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("insights frontend uses protected BI endpoint and explains deterministic priority", async () => {
  const api = await readFile(path.join(root, "api", "bi-insights.api.ts"), "utf8");
  const hook = await readFile(path.join(root, "hooks", "useBiInsights.ts"), "utf8");
  const queryKeys = await readFile(path.join(root, "query-keys", "bi-query-keys.ts"), "utf8");
  const page = await readFile(path.join(root, "components", "BiInsightsDashboard.tsx"), "utf8");
  assert.match(api, /\/admin\/bi\/insights/);
  assert.match(hook, /biQueryKeys\.insights\(filters\)/);
  assert.match(queryKeys, /insights:\s*\(filters/);
  for (const value of [
    "info",
    "success",
    "warning",
    "critical",
    "Acao recomendada",
    "Nenhum alerta",
    "determin",
    "causalidade",
    "IA",
  ])
    assert.match(page, new RegExp(value, "i"));
});
