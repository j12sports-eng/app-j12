import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("financial BI explains comparisons, deterministic trend and unavailable goals", async () => {
  const component = await readFile(
    path.join(root, "components", "BiFinancialDashboard.tsx"),
    "utf8",
  );
  const types = await readFile(path.join(root, "types", "bi-financial.types.ts"), "utf8");
  for (const text of [
    "Periodo anterior",
    "Mes anterior",
    "Mesmo mes do ano anterior",
    "media movel",
    "nao representam previsao por IA",
    "Meta indisponivel",
    "persistencia canonica",
  ])
    assert.match(component, new RegExp(text));
  for (const text of [
    "absolute",
    "percent",
    "monthOverMonth",
    "yearOverYear",
    "movingAverage",
    "achievedPercent",
    "difference",
    "status",
  ])
    assert.match(types, new RegExp(text));
});
