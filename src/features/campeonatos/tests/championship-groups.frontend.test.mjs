import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship group hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipGroups.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipGroups/);
  assert.match(source, /export function useChampionshipGroup/);
  assert.match(source, /export function useCreateChampionshipGroup/);
  assert.match(source, /export function useUpdateChampionshipGroup/);
  assert.match(source, /export function useDeleteChampionshipGroup/);
  assert.match(source, /export function useAssignRegistrationToGroup/);
  assert.match(source, /export function useRemoveRegistrationFromGroup/);
  assert.match(source, /export function useMoveRegistrationBetweenGroups/);
  assert.match(source, /export function useDrawChampionshipGroups/);
  assert.match(source, /export function useRedistributeChampionshipGroups/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship groups page references required sprint 17.6 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipGroupsPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.grupos.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Grupos do Campeonato"/);
  assert.match(pageSource, /<ChampionshipGroupFilters/);
  assert.match(pageSource, /<ChampionshipGroupForm/);
  assert.match(pageSource, /<ChampionshipGroupList/);
  assert.match(pageSource, /useChampionshipGroups/);
  assert.match(pageSource, /useAssignRegistrationToGroup/);
  assert.match(pageSource, /useDrawChampionshipGroups/);
  assert.match(pageSource, /useRedistributeChampionshipGroups/);
  assert.match(routeSource, /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/grupos"\)/);
});

test("championship group components expose expected controls", async () => {
  const formSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipGroupForm.tsx"),
    "utf8",
  );
  const listSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipGroupList.tsx"),
    "utf8",
  );
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipGroupFilters.tsx"),
    "utf8",
  );

  assert.match(formSource, /Criar grupo/);
  assert.match(formSource, /Editar grupo/);
  assert.match(formSource, /Ordem/);
  assert.match(listSource, /Mover para/);
  assert.match(listSource, /Retirar/);
  assert.match(filtersSource, /Pesquisar grupo/);
  assert.doesNotMatch(formSource, /type="file"/);
  assert.doesNotMatch(listSource, /jogos|rodadas|sumulas|mata-mata/i);
});

test("championship group api uses scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCard.tsx"),
    "utf8",
  );

  assert.match(apiSource, /listChampionshipGroups/);
  assert.match(apiSource, /createChampionshipGroup/);
  assert.match(apiSource, /assignRegistrationToGroup/);
  assert.match(apiSource, /drawChampionshipGroups/);
  assert.match(apiSource, /redistributeChampionshipGroups/);
  assert.match(apiSource, /\/grupos\/sortear/);
  assert.match(apiSource, /\/grupos\/redistribuir/);
  assert.match(typesSource, /export type ChampionshipGroup/);
  assert.match(typesSource, /export type ChampionshipGroupRegistration/);
  assert.match(cardSource, /getGroupsHref/);
});
