import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featureRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(featureRoot, "..", "..", "routes", "admin");

test("championship registration player hooks expose React Query contracts", async () => {
  const source = await readFile(
    path.join(featureRoot, "hooks", "useChampionshipRegistrationPlayers.ts"),
    "utf8",
  );

  assert.match(source, /export function useChampionshipRegistrationPlayers/);
  assert.match(source, /export function useChampionshipRegistrationPlayer/);
  assert.match(source, /export function useCreateRegistrationPlayer/);
  assert.match(source, /export function useUpdateRegistrationPlayer/);
  assert.match(source, /export function useDeleteRegistrationPlayer/);
  assert.match(source, /export function useSetCaptain/);
  assert.match(source, /invalidateRegistrationPlayerQueries/);
  assert.match(source, /useQuery/);
  assert.match(source, /useMutation/);
});

test("championship registration players page references required sprint 17.5 structure", async () => {
  const pageSource = await readFile(
    path.join(featureRoot, "pages", "ChampionshipRegistrationPlayersPage.tsx"),
    "utf8",
  );
  const routeSource = await readFile(
    path.join(routesRoot, "campeonatos.inscricoes.$registrationId.atletas.tsx"),
    "utf8",
  );
  const registrationListSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRegistrationList.tsx"),
    "utf8",
  );

  assert.match(pageSource, /<AppShell title="Elenco da Inscricao"/);
  assert.match(pageSource, /<ChampionshipRegistrationPlayersFilters/);
  assert.match(pageSource, /<ChampionshipRegistrationPlayerForm/);
  assert.match(pageSource, /<ChampionshipRegistrationPlayersList/);
  assert.match(pageSource, /useChampionshipRegistrationPlayers/);
  assert.match(pageSource, /useCreateRegistrationPlayer/);
  assert.match(pageSource, /useUpdateRegistrationPlayer/);
  assert.match(pageSource, /useDeleteRegistrationPlayer/);
  assert.match(pageSource, /useSetCaptain/);
  assert.match(pageSource, /isCancelled/);
  assert.match(
    routeSource,
    /createFileRoute\("\/admin\/campeonatos\/inscricoes\/\$registrationId\/atletas"\)/,
  );
  assert.match(registrationListSource, /getPlayersHref/);
  assert.match(registrationListSource, /Elenco/);
});

test("championship registration player components implement roster controls", async () => {
  const formSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRegistrationPlayerForm.tsx"),
    "utf8",
  );
  const listSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRegistrationPlayersList.tsx"),
    "utf8",
  );
  const filtersSource = await readFile(
    path.join(featureRoot, "components", "ChampionshipRegistrationPlayersFilters.tsx"),
    "utf8",
  );

  assert.match(formSource, /Cadastrar atleta/);
  assert.match(formSource, /Nome/);
  assert.match(formSource, /Camisa/);
  assert.match(formSource, /Definir como capitao/);
  assert.match(formSource, /Referencia futura de atleta/);
  assert.doesNotMatch(formSource, /type="file"/);
  assert.match(listSource, /Capitao/);
  assert.match(listSource, /Editar/);
  assert.match(listSource, /Excluir/);
  assert.match(filtersSource, /Pesquisar atleta/);
  assert.match(filtersSource, /CHAMPIONSHIP_REGISTRATION_PLAYER_STATUS_OPTIONS/);
  assert.match(filtersSource, /shirtNumber/);
});

test("championship registration player API exposes roster endpoints", async () => {
  const apiSource = await readFile(path.join(featureRoot, "api", "championship.api.ts"), "utf8");

  assert.match(apiSource, /listChampionshipRegistrationPlayers/);
  assert.match(apiSource, /getChampionshipRegistrationPlayer/);
  assert.match(apiSource, /createRegistrationPlayer/);
  assert.match(apiSource, /updateRegistrationPlayer/);
  assert.match(apiSource, /deleteRegistrationPlayer/);
  assert.match(apiSource, /setRegistrationPlayerCaptain/);
  assert.match(apiSource, /\/inscricoes\/\$\{encodePath\(registrationId\)\}\/atletas/);
  assert.match(apiSource, /\/capitao/);
});
