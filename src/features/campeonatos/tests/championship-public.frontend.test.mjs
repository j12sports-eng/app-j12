import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes");
const routeTreePath = path.resolve(featureRoot, "..", "..", "routeTree.gen.ts");

test("public championship hooks expose read-only React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "usePublicChampionships.ts"),
    "utf8",
  );

  assert.match(source, /export function usePublicChampionships/);
  assert.match(source, /export function usePublicChampionship/);
  assert.match(source, /export function usePublicChampionshipGroups/);
  assert.match(source, /export function usePublicChampionshipTeams/);
  assert.match(source, /export function usePublicChampionshipMatches/);
  assert.match(source, /export function usePublicChampionshipStandings/);
  assert.match(source, /export function usePublicChampionshipBracket/);
  assert.match(source, /export function usePublicChampionshipStatistics/);
  assert.match(source, /export function usePublicChampionshipTopScorers/);
  assert.match(source, /publicChampionshipQueryKeys/);
  assert.match(source, /useQuery/);
  assert.doesNotMatch(source, /useMutation|mutationFn|mutateAsync/);
});

test("public championship API keeps public read-only contracts", async () => {
  const apiSource = await readFile(
    path.join(featureRoot, "api", "championship-public.api.ts"),
    "utf8",
  );
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship-public.types.ts"),
    "utf8",
  );

  assert.match(apiSource, /const PUBLIC_CHAMPIONSHIP_ENDPOINT = "\/public\/campeonatos"/);
  assert.match(apiSource, /skipAuthHeader: true/);
  assert.match(apiSource, /skipAuthRedirect: true/);
  assert.match(apiSource, /listPublicChampionships/);
  assert.match(apiSource, /getPublicChampionship/);
  assert.match(apiSource, /listPublicChampionshipGroups/);
  assert.match(apiSource, /listPublicChampionshipTeams/);
  assert.match(apiSource, /listPublicChampionshipMatches/);
  assert.match(apiSource, /getPublicChampionshipStandings/);
  assert.match(apiSource, /getPublicChampionshipBracket/);
  assert.match(apiSource, /getPublicChampionshipStatistics/);
  assert.match(apiSource, /getPublicChampionshipTopScorers/);
  assert.doesNotMatch(apiSource, /api\.(post|put|patch|del|delete)/);
  assert.match(typesSource, /export type PublicChampionshipStatus = "PUBLISHED"/);
  assert.match(typesSource, /export type PublicStandingResponse/);
  assert.match(typesSource, /export type PublicStatisticsResponse/);
  assert.match(typesSource, /export type PublicTopScorersResponse/);
});

test("public championship pages render home and detail structures without protected mutations", async () => {
  const homeSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipPublicHomePage.tsx"),
    "utf8",
  );
  const detailsSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipPublicDetailsPage.tsx"),
    "utf8",
  );

  assert.match(homeSource, /<ChampionshipPublicLayout/);
  assert.match(homeSource, /<ChampionshipPublicCard/);
  assert.match(homeSource, /usePublicChampionships/);
  assert.match(homeSource, /Portal publico/);
  assert.match(detailsSource, /usePublicChampionship\(/);
  assert.match(detailsSource, /usePublicChampionshipGroups/);
  assert.match(detailsSource, /usePublicChampionshipTeams/);
  assert.match(detailsSource, /usePublicChampionshipMatches/);
  assert.match(detailsSource, /usePublicChampionshipStandings/);
  assert.match(detailsSource, /usePublicChampionshipBracket/);
  assert.match(detailsSource, /usePublicChampionshipStatistics/);
  assert.match(detailsSource, /usePublicChampionshipTopScorers/);
  assert.match(detailsSource, /<ChampionshipPublicGroupsView/);
  assert.match(detailsSource, /<ChampionshipPublicMatchesTable/);
  assert.match(detailsSource, /<ChampionshipPublicStandingsTable/);
  assert.match(detailsSource, /<ChampionshipPublicBracketView/);
  assert.match(detailsSource, /<ChampionshipPublicStatisticsView/);
  assert.match(detailsSource, /<ChampionshipPublicTopScorersTable/);
  assert.match(detailsSource, /id="grupos"/);
  assert.match(detailsSource, /id="equipes"/);
  assert.match(detailsSource, /id="jogos"/);
  assert.match(detailsSource, /id="classificacao"/);
  assert.match(detailsSource, /id="mata-mata"/);
  assert.match(detailsSource, /id="estatisticas"/);
  assert.match(detailsSource, /id="artilharia"/);
  assert.doesNotMatch(
    homeSource + detailsSource,
    /ProtectedRoute|useMutation|useAuth|api\.(post|put|patch|del|delete)/,
  );
});

test("public championship components remain read-only and expose required views", async () => {
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipPublicCard.tsx"),
    "utf8",
  );
  const layoutSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipPublicLayout.tsx"),
    "utf8",
  );
  const dataViewsSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipPublicDataViews.tsx"),
    "utf8",
  );
  const barrelSource = await readFile(path.join(featureRoot, "components", "index.ts"), "utf8");

  assert.match(cardSource, /\/campeonatos\/\${encodeURIComponent\(championship\.id\)}/);
  assert.match(cardSource, /Ver campeonato/);
  assert.match(layoutSource, /href="\/campeonatos"/);
  assert.match(layoutSource, /href="\/login"/);
  assert.match(dataViewsSource, /export function ChampionshipPublicGroupsView/);
  assert.match(dataViewsSource, /export function ChampionshipPublicMatchesTable/);
  assert.match(dataViewsSource, /export function ChampionshipPublicStandingsTable/);
  assert.match(dataViewsSource, /export function ChampionshipPublicBracketView/);
  assert.match(dataViewsSource, /export function ChampionshipPublicStatisticsView/);
  assert.match(dataViewsSource, /export function ChampionshipPublicTopScorersTable/);
  assert.match(dataViewsSource, /PublicEmptyState/);
  assert.match(dataViewsSource, /animate-pulse/);
  assert.match(dataViewsSource, /overflow-x-auto/);
  assert.match(barrelSource, /ChampionshipPublicCard/);
  assert.match(barrelSource, /ChampionshipPublicDataViews/);
  assert.match(barrelSource, /ChampionshipPublicLayout/);
  assert.doesNotMatch(
    cardSource + layoutSource + dataViewsSource,
    /onSubmit|type="submit"|useMutation/,
  );
});

test("public championship navigation routes are registered with TanStack Router", async () => {
  const homeRouteSource = await readFile(path.join(routesRoot, "campeonatos.tsx"), "utf8");
  const detailRouteSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.tsx"),
    "utf8",
  );
  const routeTreeSource = await readFile(routeTreePath, "utf8");

  assert.match(homeRouteSource, /createFileRoute\("\/campeonatos"\)/);
  assert.match(homeRouteSource, /ChampionshipPublicHomePage/);
  assert.match(detailRouteSource, /createFileRoute\("\/campeonatos\/\$championshipId"\)/);
  assert.match(detailRouteSource, /Route\.useParams\(\)/);
  assert.match(
    detailRouteSource,
    /<ChampionshipPublicDetailsPage championshipId=\{championshipId\}/,
  );
  assert.match(routeTreeSource, /CampeonatosRouteImport/);
  assert.match(routeTreeSource, /CampeonatosChampionshipIdRouteImport/);
  assert.match(routeTreeSource, /'\/campeonatos'/);
  assert.match(routeTreeSource, /'\/campeonatos\/\$championshipId'/);
});
