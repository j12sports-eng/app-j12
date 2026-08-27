import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeAlunoStatus } from "../../../lib/aluno-status.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const readSource = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("normalizacao frontend preserva todos os status canonicos", () => {
  assert.equal(normalizeAlunoStatus("pendente"), "pendente");
  assert.equal(normalizeAlunoStatus("experimental"), "experimental");
  assert.equal(normalizeAlunoStatus("ativo"), "ativo");
  assert.equal(normalizeAlunoStatus("inativo"), "inativo");
});

test("API e store preservam pendente e exibem o label administrativo", () => {
  const api = readSource("src/lib/alunos-api.ts");
  const store = readSource("src/lib/alunos-store.ts");

  assert.match(api, /status: normalizeAlunoStatus\(raw\.status\)/u);
  assert.match(store, /"ativo" \| "inativo" \| "experimental" \| "pendente"/u);
  assert.match(store, /case "pendente":[\s\S]*?return "Pendente de confirmação"/u);
});

test("tela Alunos possui contador, filtro e badge de pendentes separados", () => {
  const alunos = readSource("src/routes/alunos.tsx");

  assert.match(alunos, /\{ value: "pendente", label: "Pendentes" \}/u);
  assert.match(alunos, /pendentes: alunos\.filter\(\(a\) => a\.status === "pendente"\)\.length/u);
  assert.match(alunos, /\{ label: "Pendentes", value: totais\.pendentes/u);
  assert.match(alunos, /alunoStatusLabel\(status\)/u);
});

test("dashboard nao classifica pendente como ativo nem experimental", () => {
  const dashboard = readSource("src/routes/dashboard.tsx");

  assert.match(dashboard, /normalizeText\(aluno\.status\) === "ativo"/u);
  assert.match(dashboard, /normalizeText\(aluno\.status\) === "experimental"/u);
  assert.match(dashboard, /normalizeText\(aluno\.status\) === "pendente"/u);
  assert.match(dashboard, /\$\{pendingStudents\} pendentes/u);
});

test("portal e turma nao promovem aluno pendente automaticamente", () => {
  const portal = readSource("src/routes/portal-responsavel/meus-filhos.tsx");
  const turmaDialog = readSource("src/components/turmas/AdicionarAlunoDialog.tsx");

  assert.match(portal, /toLowerCase\(\) === "ativo"/u);
  assert.match(turmaDialog, /const pendente = a\.status === "pendente"/u);
  assert.match(turmaDialog, /disabled=\{pendente\}/u);
  assert.match(turmaDialog, /alunoStatusLabel\(a\.status\)/u);
});
