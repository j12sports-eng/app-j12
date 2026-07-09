import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship match report hooks expose React Query contracts", async () => {
  const source = await readFile(path.join(featureRoot, "hooks", "useMatchReport.ts"), "utf8");

  assert.match(source, /export function useMatchReport/);
  assert.match(source, /export function useCreateMatchReport/);
  assert.match(source, /export function useUpdateMatchReport/);
  assert.match(source, /export function useFinalizeMatchReport/);
  assert.match(source, /export function useReopenMatchReport/);
  assert.match(source, /export function useMatchEvents/);
  assert.match(source, /useCreateMatchEvent/);
  assert.match(source, /useUpdateMatchEvent/);
  assert.match(source, /useDeleteMatchEvent/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship match report page references required sprint 17.10 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipMatchReportPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.$championshipId.jogos.$matchId.sumula.tsx"),
    "utf8",
  );
  const roundListSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRoundList.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Sumula Digital"/);
  assert.match(pageSource, /<ChampionshipMatchReportForm/);
  assert.match(pageSource, /<ChampionshipGoalForm/);
  assert.match(pageSource, /<ChampionshipCardForm/);
  assert.match(pageSource, /<ChampionshipSubstitutionForm/);
  assert.match(pageSource, /<ChampionshipMatchTimeline/);
  assert.match(pageSource, /<ChampionshipMatchEventsList/);
  assert.match(
    routeSource,
    /createFileRoute\("\/admin\/campeonatos\/\$championshipId\/jogos\/\$matchId\/sumula"\)/,
  );
  assert.match(roundListSource, /getMatchReportHref/);
  assert.match(roundListSource, /Sumula/);
});

test("championship match report components cover events and finalization", async () => {
  const formSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipMatchReportForm.tsx"),
    "utf8",
  );
  const eventsSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipMatchEventsList.tsx"),
    "utf8",
  );
  const goalSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipGoalForm.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipCardForm.tsx"),
    "utf8",
  );
  const substitutionSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipSubstitutionForm.tsx"),
    "utf8",
  );
  const timelineSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipMatchTimeline.tsx"),
    "utf8",
  );

  assert.match(formSource, /Finalizar/);
  assert.match(formSource, /Reabrir/);
  assert.match(eventsSource, /Editar/);
  assert.match(eventsSource, /Remover/);
  assert.match(goalSource, /Registrar gol/);
  assert.match(cardSource, /YELLOW_CARD/);
  assert.match(cardSource, /RED_CARD/);
  assert.match(cardSource, /FOUL/);
  assert.match(cardSource, /WALKOVER/);
  assert.match(substitutionSource, /SUBSTITUTION/);
  assert.match(timelineSource, /Linha do tempo/);
  assert.doesNotMatch(
    formSource + eventsSource + goalSource + cardSource + substitutionSource + timelineSource,
    /ranking|estatistica|portal publico/i,
  );
});

test("championship match report API and types use scoped REST endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");
  const typesSource = await readFile(
    path.join(featureRoot, "types", "championship.types.ts"),
    "utf8",
  );

  assert.match(apiSource, /getMatchReport/);
  assert.match(apiSource, /createMatchReport/);
  assert.match(apiSource, /updateMatchReport/);
  assert.match(apiSource, /createMatchReportEvent/);
  assert.match(apiSource, /finalizeMatchReport/);
  assert.match(apiSource, /reopenMatchReport/);
  assert.match(apiSource, /\/sumula\/eventos/);
  assert.match(apiSource, /\/sumula\/finalizar/);
  assert.match(typesSource, /export type ChampionshipMatchReport/);
  assert.match(typesSource, /export type ChampionshipMatchEvent/);
  assert.match(typesSource, /export type ChampionshipMatchReportFinalizePayload/);
});
