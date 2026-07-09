import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship statistics hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipStatistics.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipStatistics/);
  assert.match(source, /export function useChampionshipRankings/);
  assert.match(source, /export function useTopScorers/);
  assert.match(source, /export function useTeamStatistics/);
  assert.match(source, /export function usePlayerStatistics/);
  assert.match(source, /export function useRecalculateStatistics/);
  assert.match(source, /championshipStatisticsQueryKeys/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
  assert.match(source, /select: \(data\) => data\.teams/);
  assert.match(source, /select: \(data\) => data\.athletes/);
});

test("championship statistics page references required sprint 17.11 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipStatisticsPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.estatisticas.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCard.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Estatisticas do Campeonato"/);
  assert.match(pageSource, /<ChampionshipStatisticsCards/);
  assert.match(pageSource, /<ChampionshipRankingsTabs/);
  assert.match(pageSource, /<ChampionshipTopScorersTable/);
  assert.match(pageSource, /<ChampionshipTeamStatisticsTable/);
  assert.match(pageSource, /<ChampionshipPlayerStatisticsTable/);
  assert.match(pageSource, /<ChampionshipStatisticsFilters/);
  assert.match(pageSource, /useRecalculateStatistics/);
  assert.match(
    routeSource,
    /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/estatisticas"\)/,
  );
  assert.match(cardSource, /getStatisticsHref/);
  assert.match(cardSource, /Estatisticas/);
});

test("championship statistics components cover filters, rankings and table states", async () => {
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipStatisticsFilters.tsx"),
    "utf8",
  );
  const rankingSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRankingsTabs.tsx"),
    "utf8",
  );
  const teamTableSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipTeamStatisticsTable.tsx"),
    "utf8",
  );
  const playerTableSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipPlayerStatisticsTable.tsx"),
    "utf8",
  );
  const scorerTableSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipTopScorersTable.tsx"),
    "utf8",
  );

  assert.match(filtersSource, /Pesquisa/);
  assert.match(filtersSource, /Itens por pagina/);
  assert.match(filtersSource, /Anterior/);
  assert.match(filtersSource, /Proxima/);
  assert.match(rankingSource, /Artilharia/);
  assert.match(rankingSource, /fair play/i);
  assert.match(rankingSource, /melhor ataque/i);
  assert.match(rankingSource, /melhor defesa/i);
  assert.match(teamTableSource, /overflow-x-auto/);
  assert.match(playerTableSource, /overflow-x-auto/);
  assert.match(scorerTableSource, /overflow-x-auto/);
  assert.match(teamTableSource + playerTableSource + scorerTableSource, /animate-pulse/);
  assert.match(teamTableSource + playerTableSource + scorerTableSource, /Nenhum/);
  assert.doesNotMatch(
    filtersSource + rankingSource + teamTableSource + playerTableSource + scorerTableSource,
    /portal publico|polling/i,
  );
});

test("championship statistics API and types use scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );

  assert.match(apiSource, /getChampionshipStatistics/);
  assert.match(apiSource, /getChampionshipRankings/);
  assert.match(apiSource, /getChampionshipTopScorers/);
  assert.match(apiSource, /recalculateChampionshipStatistics/);
  assert.match(apiSource, /\/estatisticas/);
  assert.match(apiSource, /\/rankings/);
  assert.match(apiSource, /\/artilharia/);
  assert.match(typesSource, /export type ChampionshipStatisticsResponse/);
  assert.match(typesSource, /export type ChampionshipRankings/);
  assert.match(typesSource, /export type ChampionshipTeamStatistics/);
  assert.match(typesSource, /export type ChampionshipPlayerStatistics/);
});

test("match report mutations invalidate championship statistics without polling", async () => {
  const source = await readFile(path.join(featureRoot, "hooks", "useMatchReport.ts"), "utf8");

  assert.match(source, /championshipStatisticsQueryKeys/);
  assert.match(source, /invalidateStatisticsQueries/);
  assert.match(source, /championshipStatisticsQueryKeys\.all/);
  assert.doesNotMatch(source, /refetchInterval|setInterval|polling/i);
});
