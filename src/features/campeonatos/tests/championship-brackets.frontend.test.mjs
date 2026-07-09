import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship bracket hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipBracket.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipBracket/);
  assert.match(source, /export function useGenerateBracket/);
  assert.match(source, /export function useUpdateBracketMatch/);
  assert.match(source, /export function useDeleteBracket/);
  assert.match(source, /export function useAdvanceBracket/);
  assert.match(source, /championshipBracketQueryKeys/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship bracket page references required sprint 17.9 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipBracketPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.mata-mata.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCard.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Mata-mata do Campeonato"/);
  assert.match(pageSource, /<ChampionshipBracketFilters/);
  assert.match(pageSource, /<ChampionshipBracketTree/);
  assert.match(pageSource, /<ChampionshipGenerateBracketDialog/);
  assert.match(pageSource, /useChampionshipBracket/);
  assert.match(pageSource, /useGenerateBracket/);
  assert.match(pageSource, /useUpdateBracketMatch/);
  assert.match(pageSource, /useAdvanceBracket/);
  assert.match(
    routeSource,
    /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/mata-mata"\)/,
  );
  assert.match(cardSource, /getBracketHref/);
  assert.match(cardSource, /Mata-mata/);
});

test("championship bracket components expose tree, filters and match controls", async () => {
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipBracketFilters.tsx"),
    "utf8",
  );
  const treeSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipBracketTree.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipBracketMatchCard.tsx"),
    "utf8",
  );
  const generateSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipGenerateBracketDialog.tsx"),
    "utf8",
  );

  assert.match(filtersSource, /Filtros do mata-mata/);
  assert.match(treeSource, /Mata-mata sem jogos nesta fase/);
  assert.match(cardSource, /Avancar vencedor/);
  assert.match(cardSource, /Salvar/);
  assert.match(generateSource, /Gerar chaveamento/);
  assert.doesNotMatch(
    filtersSource + treeSource + cardSource + generateSource,
    /sumula|estatistica|portal publico/i,
  );
});

test("championship bracket API uses scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );

  assert.match(apiSource, /getChampionshipBracket/);
  assert.match(apiSource, /generateChampionshipBracket/);
  assert.match(apiSource, /updateChampionshipBracketMatch/);
  assert.match(apiSource, /advanceChampionshipBracketMatch/);
  assert.match(apiSource, /deleteChampionshipBracket/);
  assert.match(apiSource, /\/playoffs\/gerar/);
  assert.match(apiSource, /\/playoffs\/matches\//);
  assert.match(typesSource, /export type ChampionshipBracket/);
  assert.match(typesSource, /export type ChampionshipBracketMatch/);
});
