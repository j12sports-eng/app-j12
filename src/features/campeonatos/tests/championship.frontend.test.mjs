import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");

test("championship hooks expose the required React Query contracts", async () => {
  const source = await readFile(path.join(featureRoot, "hooks", "useChampionships.ts"), "utf8");

  assert.match(source, /export function useChampionships/);
  assert.match(source, /export function useChampionship/);
  assert.match(source, /export function useCreateChampionship/);
  assert.match(source, /export function useUpdateChampionship/);
  assert.match(source, /export function usePublishChampionship/);
  assert.match(source, /export function useArchiveChampionship/);
  assert.match(source, /export function useDeleteChampionship/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship admin page references the base rendering structure", async () => {
  const source = await readFile(
    path.join(featureRoot, "pages", "ChampionshipsAdminPage.tsx"),
    "utf8",
  );

  assert.match(source, /<AppShell title="Campeonatos"/);
  assert.match(source, /<ChampionshipFilters/);
  assert.match(source, /<ChampionshipCard/);
  assert.match(source, /<ChampionshipForm/);
  assert.match(source, /Gerenciamento de Campeonatos/);
  assert.match(source, /<ProtectedRoute roles=\{\["admin", "coordenador"\]\}/);
});

test("championship logo structure does not expose real upload controls", async () => {
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );
  const formSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipForm.tsx"),
    "utf8",
  );

  assert.match(typesSource, /export type ChampionshipLogo/);
  assert.match(typesSource, /fileId\?: string \| null/);
  assert.doesNotMatch(formSource, /type="file"/);
  assert.doesNotMatch(formSource, /multipart/i);
});

test("championship team and technical commission are prepared as types only", async () => {
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");

  assert.match(typesSource, /export type ChampionshipTeam/);
  assert.match(typesSource, /export type ChampionshipTeamCommissionMember/);
  assert.match(typesSource, /technicalCommission: ChampionshipTeamCommissionMember\[\]/);
  assert.doesNotMatch(apiSource, /technical-commission|comissao|comissão/i);
});
