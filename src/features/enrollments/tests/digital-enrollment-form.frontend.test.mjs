import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const route = fs.readFileSync(path.join(root, "src/routes/matricula.$token.tsx"), "utf8");
const api = fs.readFileSync(
  path.join(root, "src/features/enrollments/api/digital-invitation-public.ts"),
  "utf8",
);

test("digital enrollment route is a six-step wizard with visible save states", () => {
  for (const label of [
    "Responsável",
    "Aluno",
    "Endereço",
    "Informações adicionais",
    "Revisão",
    "Salvando...",
    "Salvo",
    "Erro ao salvar",
    "Conflito",
  ]) {
    assert.match(route, new RegExp(label));
  }
  assert.match(route, /onBlur/);
});

test("digital enrollment API carries revision and exposes canonical reads and writes", () => {
  for (const endpoint of ["/form", "/advance", "/review"]) {
    assert.match(api, new RegExp(endpoint.replace("/", "\\/")));
  }
  assert.match(api, /`\/\$\{endpoint\}`/);
  assert.match(api, /revision/);
  assert.match(api, /method: "PATCH"/);
  assert.match(api, /method: "POST"/);
  assert.match(api, /credentials: "omit"/);
  assert.match(api, /referrerPolicy: "no-referrer"/);
});
