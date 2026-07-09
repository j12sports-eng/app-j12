import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship standing hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipStandings.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipStandings/);
  assert.match(source, /export function useRecalculateChampionshipStandings/);
  assert.match(source, /championshipStandingQueryKeys/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship standings page references required sprint 17.8 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipStandingsPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.classificacao.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCard.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Classificacao do Campeonato"/);
  assert.match(pageSource, /<ChampionshipStandingFilters/);
  assert.match(pageSource, /<ChampionshipStandingTable/);
  assert.match(pageSource, /useChampionshipStandings/);
  assert.match(pageSource, /useRecalculateChampionshipStandings/);
  assert.match(pageSource, /Recalcular/);
  assert.match(
    routeSource,
    /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/classificacao"\)/,
  );
  assert.match(cardSource, /getStandingsHref/);
  assert.match(cardSource, /Classificacao/);
});

test("championship standing components expose table controls only", async () => {
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipStandingFilters.tsx"),
    "utf8",
  );
  const tableSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipStandingTable.tsx"),
    "utf8",
  );

  assert.match(filtersSource, /Criterios de desempate/);
  assert.match(filtersSource, /Classificacao geral/);
  assert.match(tableSource, /Classificacao sem equipes/);
  assert.match(tableSource, /Por grupo/);
  assert.match(tableSource, /PTS/);
  assert.doesNotMatch(filtersSource + tableSource, /mata-mata|sumula|estatistica|portal publico/i);
});

test("championship standing API uses scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );
  const groupsHookSource = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipGroups.ts"),
    "utf8",
  );

  assert.match(apiSource, /listChampionshipStandings/);
  assert.match(apiSource, /recalculateChampionshipStandings/);
  assert.match(apiSource, /\/classificacao/);
  assert.match(typesSource, /export type ChampionshipStanding/);
  assert.match(typesSource, /export type ChampionshipStandingResponse/);
  assert.match(groupsHookSource, /championshipStandingQueryKeys/);
});
