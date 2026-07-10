import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("court BI frontend uses shared client and required views", async () => {
  const api = await readFile(path.join(root, "api", "bi-courts.api.ts"), "utf8");
  const page = await readFile(path.join(root, "components", "BiCourtsDashboard.tsx"), "utf8");
  assert.match(api, /@\/lib\/api/);
  assert.doesNotMatch(api, /fetch\(|axios/);
  for (const value of [
    "Horas disponiveis",
    "Horas reservadas",
    "Taxa de ocupacao",
    "Receita de locacoes",
    "Horarios de pico",
    "Dias de maior demanda",
    "Ocupacao por quadra",
    "Receita por quadra",
    "CUSTOM",
  ])
    assert.match(page, new RegExp(value));
});
