import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("delinquency frontend uses shared client and operational states", async () => {
  const api = await readFile(path.join(feature, "api", "bi-delinquency.api.ts"), "utf8");
  const page = await readFile(
    path.join(feature, "components", "BiDelinquencyDashboard.tsx"),
    "utf8",
  );
  assert.match(api, /@\/lib\/api/);
  assert.doesNotMatch(api, /fetch\(|axios/);
  for (const value of [
    "isLoading",
    "isError",
    "Aging da inadimplencia",
    "Evolucao por vencimento",
    "Cobrancas por status",
    "CUSTOM",
  ])
    assert.match(page, new RegExp(value));
  assert.doesNotMatch(page, /cpf|telefone|nome_aluno|email/i);
});
