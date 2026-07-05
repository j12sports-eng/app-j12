const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeRegistrationStatus,
  validateCreateRegistrationInput,
  validateRegistrationListInput,
  validateUpdateRegistrationStatusInput,
} = require("../validators/index.js");

test("validateCreateRegistrationInput normalizes required registration fields", () => {
  const values = validateCreateRegistrationInput({
    campeonatoId: "camp-1",
    equipeId: "team-1",
    observacoes: "Pagamento pendente",
  });

  assert.equal(values.championshipId, "camp-1");
  assert.equal(values.teamId, "team-1");
  assert.equal(values.observations, "Pagamento pendente");
  assert.equal(values.confirm, false);
});

test("normalizeRegistrationStatus supports portuguese labels", () => {
  assert.equal(normalizeRegistrationStatus("Pendente"), "PENDING");
  assert.equal(normalizeRegistrationStatus("Confirmada"), "CONFIRMED");
  assert.equal(normalizeRegistrationStatus("Recusada"), "REFUSED");
  assert.equal(normalizeRegistrationStatus("Cancelada"), "CANCELLED");
});

test("validateRegistrationListInput prepares pagination and sorting", () => {
  const values = validateRegistrationListInput({
    limit: "12",
    page: "3",
    sortBy: "teamName",
    sortDirection: "ASC",
    status: "confirmada",
  });

  assert.equal(values.limit, 12);
  assert.equal(values.page, 3);
  assert.equal(values.sortBy, "teamName");
  assert.equal(values.sortDirection, "ASC");
  assert.equal(values.status, "CONFIRMED");
});

test("validateUpdateRegistrationStatusInput rejects invalid status", () => {
  assert.throws(
    () => validateUpdateRegistrationStatusInput({ status: "aguardando sorteio" }),
    /Status de inscricao invalido/,
  );
});
