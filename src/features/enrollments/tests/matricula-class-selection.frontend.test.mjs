import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTrainingSelectionPayload,
  isSameTurmaId,
  normalizeTurmaId,
} from "../training-selection.ts";

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

test("matricula preserves parallel training arrays when distinct turmas have the same name", () => {
  const trainingBlocks = [
    { turmaId: "10", modalidade: "Futsal", unidade: "A" },
    { turmaId: "22", modalidade: "Society", unidade: "B" },
  ];
  const horarioOptions = [
    {
      turmaId: 10,
      turmaNome: "Manhã | Turma 1",
      modalidade: "Futsal",
      unidade: "A",
      horarioLabel: "10:00 - 11:00",
    },
    {
      turmaId: 22,
      turmaNome: "Manhã | Turma 1",
      modalidade: "Society",
      unidade: "B",
      horarioLabel: "09:00 - 10:00",
    },
  ];

  assert.deepEqual(buildTrainingSelectionPayload(trainingBlocks, horarioOptions), {
    modalidades: ["Futsal", "Society"],
    unidades: ["A", "B"],
    turmas: ["Manhã | Turma 1", "Manhã | Turma 1"],
    horarios: ["10:00 - 11:00", "09:00 - 10:00"],
  });
});

test("matricula preserves block order when selected turmas have different names", () => {
  const trainingBlocks = [
    { turmaId: "10", modalidade: "Futsal", unidade: "A" },
    { turmaId: "22", modalidade: "Society", unidade: "B" },
  ];
  const horarioOptions = [
    {
      turmaId: "22",
      turmaNome: "Noite | Turma 2",
      modalidade: "Society",
      unidade: "B",
      horarioLabel: "19:00 - 20:00",
    },
    {
      turmaId: "10",
      turmaNome: "Manhã | Turma 1",
      modalidade: "Futsal",
      unidade: "A",
      horarioLabel: "10:00 - 11:00",
    },
  ];

  assert.deepEqual(buildTrainingSelectionPayload(trainingBlocks, horarioOptions), {
    modalidades: ["Futsal", "Society"],
    unidades: ["A", "B"],
    turmas: ["Manhã | Turma 1", "Noite | Turma 2"],
    horarios: ["10:00 - 11:00", "19:00 - 20:00"],
  });
});

test("matricula route uses the ordered training payload without deduplicating turma names", () => {
  assert.match(route, /buildTrainingSelectionPayload\(normalizedBlocks, horarioOptions\)/);
  assert.doesNotMatch(route, /turmas: uniqueValues\(selectedOptions/);
});
