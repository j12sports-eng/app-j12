const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  validateChampionshipGroupAssignmentInput,
  validateChampionshipGroupDrawInput,
  validateChampionshipGroupListInput,
  validateChampionshipGroupMoveInput,
  validateCreateChampionshipGroupInput,
  validateUpdateChampionshipGroupInput,
} = require("../validators/index.js");

test("validateCreateChampionshipGroupInput normalizes group payload", () => {
  const values = validateCreateChampionshipGroupInput("camp-1", {
    nome: "Grupo A",
    ordem: "2",
  });

  assert.equal(values.championshipId, "camp-1");
  assert.equal(values.name, "Grupo A");
  assert.equal(values.displayOrder, 2);
});

test("validateUpdateChampionshipGroupInput supports partial updates", () => {
  const values = validateUpdateChampionshipGroupInput("camp-1", "grupo-1", {
    display_order: "4",
  });

  assert.equal(values.championshipId, "camp-1");
  assert.equal(values.groupId, "grupo-1");
  assert.equal(values.displayOrder, 4);
  assert.equal(Object.prototype.hasOwnProperty.call(values, "name"), false);
});

test("validateChampionshipGroupListInput prepares pagination and sorting", () => {
  const values = validateChampionshipGroupListInput("camp-1", {
    limit: "12",
    page: "2",
    search: "grupo",
    sortBy: "name",
    sortDirection: "DESC",
  });

  assert.equal(values.limit, 12);
  assert.equal(values.page, 2);
  assert.equal(values.search, "grupo");
  assert.equal(values.sortBy, "name");
  assert.equal(values.sortDirection, "DESC");
});

test("group validators normalize assignment, move and draw inputs", () => {
  const assignment = validateChampionshipGroupAssignmentInput("camp-1", "grupo-1", {
    inscricaoId: "insc-1",
    posicao: "3",
  });
  const move = validateChampionshipGroupMoveInput("camp-1", "grupo-1", "insc-1", {
    grupoDestinoId: "grupo-2",
  });
  const draw = validateChampionshipGroupDrawInput("camp-1", {
    quantidadeGrupos: "4",
    sortear: "sim",
  });

  assert.equal(assignment.registrationId, "insc-1");
  assert.equal(assignment.drawPosition, 3);
  assert.equal(move.targetGroupId, "grupo-2");
  assert.equal(draw.groupCount, 4);
  assert.equal(draw.shuffle, true);
});

test("validateCreateChampionshipGroupInput rejects empty group name", () => {
  assert.throws(
    () => validateCreateChampionshipGroupInput("camp-1", { name: "" }),
    /name e obrigatorio/,
  );
});
