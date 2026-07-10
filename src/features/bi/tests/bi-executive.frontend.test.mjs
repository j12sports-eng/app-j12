import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("executive API uses shared client and all supported filters", async () => {
  const source = await readFile(path.join(root, "api", "bi-executive.api.ts"), "utf8");
  assert.match(source, /import \{ api \} from "@\/lib\/api"/);
  assert.match(source, /\/admin\/bi\/executive/);
  for (const filter of ["period", "startDate", "endDate", "unitId"])
    assert.match(source, new RegExp(filter));
  assert.doesNotMatch(source, /axios|fetch\(/);
});
test("executive hook uses dedicated stable query key", async () => {
  const hook = await readFile(path.join(root, "hooks", "useBiExecutive.ts"), "utf8");
  const keys = await readFile(path.join(root, "query-keys", "bi-query-keys.ts"), "utf8");
  assert.match(hook, /useQuery/);
  assert.match(hook, /biQueryKeys\.executive/);
  assert.match(keys, /"executive"/);
});
test("dashboard handles loading, error, unavailable comparison and custom filters", async () => {
  const source = await readFile(path.join(root, "components", "BiExecutiveDashboard.tsx"), "utf8");
  for (const value of [
    "isLoading",
    "isError",
    "Indisponivel",
    "Comparacao indisponivel",
    "CUSTOM",
    "startDate",
    "endDate",
  ])
    assert.match(source, new RegExp(value));
  assert.doesNotMatch(source, /recharts|comparisonChart/);
});
