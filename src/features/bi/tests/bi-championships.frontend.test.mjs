import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("championship BI frontend uses shared infrastructure and administrative views", async () => {
  const api = await readFile(path.join(root, "api", "bi-championships.api.ts"), "utf8");
  const page = await readFile(
    path.join(root, "components", "BiChampionshipsDashboard.tsx"),
    "utf8",
  );
  const hook = await readFile(path.join(root, "hooks", "useBiChampionships.ts"), "utf8");
  assert.match(api, /@\/lib\/api/);
  assert.doesNotMatch(api, /fetch\(|axios/);
  assert.match(hook, /useQuery/);
  for (const label of [
    "Campeonatos ativos",
    "Equipes inscritas",
    "Participantes",
    "Partidas realizadas",
    "Distribuicao por categoria",
    "Evolucao de inscricoes",
    "Ranking administrativo",
    "Indisponivel",
    "CUSTOM",
  ])
    assert.match(page, new RegExp(label));
});
test("championship BI frontend does not expose competitive mutations or personal data", async () => {
  const source = await readFile(
    path.join(root, "components", "BiChampionshipsDashboard.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /document|birthDate|responsible|alterar resultado|recalcular/i);
});
