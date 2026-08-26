import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isSameTurmaId, normalizeTurmaId } from "../training-selection.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const route = fs.readFileSync(path.join(root, "src/routes/matricula.tsx"), "utf8");

test("matricula keeps a numeric API turmaId selected when the select emits a string", () => {
  const apiTurma = { id: 12, nome: "Sub-13" };
  const horarioOptions = [
    {
      turmaId: normalizeTurmaId(apiTurma.id),
      turmaNome: apiTurma.nome,
    },
  ];
  const selectValue = "12";

  const selectedOption = horarioOptions.find((candidate) =>
    isSameTurmaId(candidate.turmaId, selectValue),
  );

  assert.equal(horarioOptions[0].turmaId, "12");
  assert.equal(selectedOption?.turmaNome, "Sub-13");
  assert.equal(selectedOption?.turmaId, selectValue);
});

test("matricula duplicate detection compares turmaIds without loose equality", () => {
  const existingTraining = { turmaId: "12" };
  const apiOption = { turmaId: 12 };

  assert.equal(isSameTurmaId(existingTraining.turmaId, apiOption.turmaId), true);
  assert.equal(isSameTurmaId(existingTraining.turmaId, 13), false);
});

test("matricula route wires runtime normalization into options and select matching", () => {
  assert.match(route, /turmaId: normalizeTurmaId\(turma\.id\)/);
  assert.match(route, /isSameTurmaId\(candidate\.turmaId, normalizedValue\)/);
  assert.doesNotMatch(route, /candidate\.turmaId === value/);
});
