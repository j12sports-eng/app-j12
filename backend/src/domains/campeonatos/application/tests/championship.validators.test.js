const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  validateCreateChampionshipInput,
  validateUpdateChampionshipInput,
} = require("../validators/index.js");

test("validateCreateChampionshipInput normalizes the base contract", () => {
  const values = validateCreateChampionshipInput({
    categoria: "Sub-13",
    dataFinal: "2026-09-30",
    dataInicial: "2026-09-01",
    logo: {
      fileId: "file-copa-j12",
      originalName: "copa-j12.png",
      publicUrl: "https://cdn.j12.test/campeonatos/copa-j12.png",
      storageKey: "campeonatos/copa-j12.png",
    },
    modalidade: "Futsal",
    nome: "Copa J12",
  });

  assert.equal(values.name, "Copa J12");
  assert.equal(values.category, "Sub-13");
  assert.equal(values.modality, "Futsal");
  assert.equal(values.status, "DRAFT");
  assert.equal(values.metadata.logo.fileId, "file-copa-j12");
  assert.equal(values.metadata.logo.storageKey, "campeonatos/copa-j12.png");
});

test("validateCreateChampionshipInput requires name, category and modality", () => {
  assert.throws(
    () =>
      validateCreateChampionshipInput({
        dataFinal: "2026-09-30",
        dataInicial: "2026-09-01",
      }),
    /name e obrigatorio/,
  );
});

test("validateUpdateChampionshipInput rejects inverted date ranges", () => {
  assert.throws(
    () =>
      validateUpdateChampionshipInput({
        endDate: "2026-09-01",
        startDate: "2026-09-30",
      }),
    /Data final/,
  );
});

test("validateCreateChampionshipInput rejects real logo upload payloads", () => {
  assert.throws(
    () =>
      validateCreateChampionshipInput({
        category: "Livre",
        endDate: "2026-09-30",
        logo: { base64: "data:image/png;base64,AAA" },
        modality: "Futsal",
        name: "Copa J12",
        startDate: "2026-09-01",
      }),
    /Upload de logo ainda nao esta disponivel/,
  );
});
