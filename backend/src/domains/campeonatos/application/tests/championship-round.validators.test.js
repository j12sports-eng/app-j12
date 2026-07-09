const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  validateChampionshipMatchListInput,
  validateChampionshipRoundListInput,
  validateCreateChampionshipMatchInput,
  validateCreateChampionshipRoundInput,
  validateGenerateChampionshipMatchesInput,
  validateMoveChampionshipMatchInput,
  validateUpdateChampionshipMatchInput,
  validateUpdateChampionshipRoundInput,
} = require("../validators/index.js");

test("round validators normalize create, update and list inputs", () => {
  const create = validateCreateChampionshipRoundInput("camp-1", {
    fase: "fase de grupos",
    nome: "Rodada 1",
    numero: "1",
  });
  const update = validateUpdateChampionshipRoundInput("camp-1", "rodada-1", {
    round_number: "2",
  });
  const list = validateChampionshipRoundListInput("camp-1", {
    limit: "12",
    page: "2",
    phase: "GROUP_STAGE",
    search: "rodada",
    sortBy: "name",
    sortDirection: "DESC",
  });

  assert.equal(create.phase, "GROUP_STAGE");
  assert.equal(create.name, "Rodada 1");
  assert.equal(create.roundNumber, 1);
  assert.equal(update.roundId, "rodada-1");
  assert.equal(update.roundNumber, 2);
  assert.equal(list.limit, 12);
  assert.equal(list.page, 2);
  assert.equal(list.sortBy, "name");
  assert.equal(list.sortDirection, "DESC");
});

test("match validators normalize create, update, move, list and generation inputs", () => {
  const create = validateCreateChampionshipMatchInput("camp-1", "rodada-1", {
    dataJogo: "2026-08-10",
    grupoId: "grupo-1",
    horaInicio: "9:05:00",
    mandanteInscricaoId: "insc-1",
    quadra: "Quadra 1",
    visitanteInscricaoId: "insc-2",
  });
  const update = validateUpdateChampionshipMatchInput("camp-1", "jogo-1", {
    status: "adiado",
  });
  const move = validateMoveChampionshipMatchInput("camp-1", "jogo-1", {
    rodadaDestinoId: "rodada-2",
  });
  const list = validateChampionshipMatchListInput("camp-1", {
    groupId: "grupo-1",
    status: "agendado",
  });
  const generate = validateGenerateChampionshipMatchesInput("camp-1", {
    fase: "grupos",
    substituir: "sim",
  });

  assert.equal(create.matchDate, "2026-08-10");
  assert.equal(create.startTime, "09:05");
  assert.equal(create.status, "SCHEDULED");
  assert.equal(update.status, "POSTPONED");
  assert.equal(move.targetRoundId, "rodada-2");
  assert.equal(list.status, "SCHEDULED");
  assert.equal(generate.phase, "GROUP_STAGE");
  assert.equal(generate.replace, true);
});

test("match validators reject invalid time and equal implicit ids", () => {
  assert.throws(
    () =>
      validateCreateChampionshipMatchInput("camp-1", "rodada-1", {
        grupoId: "grupo-1",
        horaInicio: "33:00",
        mandanteInscricaoId: "insc-1",
        visitanteInscricaoId: "insc-2",
      }),
    /Horario do jogo invalido/,
  );
});
