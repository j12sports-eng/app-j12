import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship round hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipRounds.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipRounds/);
  assert.match(source, /export function useChampionshipRound/);
  assert.match(source, /export function useChampionshipMatches/);
  assert.match(source, /export function useCreateChampionshipRound/);
  assert.match(source, /export function useUpdateChampionshipRound/);
  assert.match(source, /export function useDeleteChampionshipRound/);
  assert.match(source, /export function useCreateChampionshipMatch/);
  assert.match(source, /export function useUpdateChampionshipMatch/);
  assert.match(source, /export function useMoveChampionshipMatch/);
  assert.match(source, /export function useGenerateChampionshipMatches/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship rounds page references required sprint 17.7 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipRoundsPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.rodadas.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCard.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Rodadas do Campeonato"/);
  assert.match(pageSource, /<ChampionshipRoundFilters/);
  assert.match(pageSource, /<ChampionshipRoundForm/);
  assert.match(pageSource, /<ChampionshipMatchForm/);
  assert.match(pageSource, /<ChampionshipRoundList/);
  assert.match(pageSource, /useChampionshipRounds/);
  assert.match(pageSource, /useCreateChampionshipMatch/);
  assert.match(pageSource, /useGenerateChampionshipMatches/);
  assert.match(routeSource, /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/rodadas"\)/);
  assert.match(cardSource, /getRoundsHref/);
  assert.match(cardSource, /Rodadas/);
});

test("championship round components expose scheduling controls only", async () => {
  const roundFormSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRoundForm.tsx"),
    "utf8",
  );
  const matchFormSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipMatchForm.tsx"),
    "utf8",
  );
  const listSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRoundList.tsx"),
    "utf8",
  );
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRoundFilters.tsx"),
    "utf8",
  );

  assert.match(roundFormSource, /Criar rodada/);
  assert.match(matchFormSource, /Novo jogo/);
  assert.match(matchFormSource, /Mandante/);
  assert.match(matchFormSource, /Visitante/);
  assert.match(matchFormSource, /Quadra/);
  assert.match(listSource, /Mover para/);
  assert.match(listSource, /Sumula/);
  assert.match(listSource, /Remover/);
  assert.match(filtersSource, /Pesquisar rodada/);
  assert.doesNotMatch(roundFormSource + matchFormSource + listSource, /type="file"|multipart/i);
  assert.doesNotMatch(roundFormSource + matchFormSource + listSource, /estatistica/i);
});

test("championship round API uses scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );

  assert.match(apiSource, /listChampionshipRounds/);
  assert.match(apiSource, /createChampionshipRound/);
  assert.match(apiSource, /listChampionshipMatches/);
  assert.match(apiSource, /createChampionshipMatch/);
  assert.match(apiSource, /moveChampionshipMatch/);
  assert.match(apiSource, /generateChampionshipMatches/);
  assert.match(apiSource, /\/rodadas\/gerar-jogos/);
  assert.match(typesSource, /export type ChampionshipRound/);
  assert.match(typesSource, /export type ChampionshipMatch/);
});
