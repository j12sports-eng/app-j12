"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureStudentMonthlyCharge } = require("./student-finance.js");

test("aluno pendente nao gera mensalidade automatica", async () => {
  let executeCalls = 0;
  const connection = {
    async execute() {
      executeCalls += 1;
      throw new Error("aluno pendente nao deveria consultar ou gravar cobranca");
    },
  };

  const result = await ensureStudentMonthlyCharge(
    connection,
    {
      id: 96,
      status: "pendente",
      plano_id: "plano-base",
      plano_principal: "Plano Base",
      plano_valor: 150,
      financeiro_json: JSON.stringify({
        planoId: "plano-base",
        planoNome: "Plano Base",
        valorPlano: 150,
        recorrenciaAtiva: true,
      }),
    },
    { referenceCompetencia: "2026-08", planCatalog: [] },
  );

  assert.equal(result.created, false);
  assert.equal(result.skippedReason, "inactive_or_unconfigured");
  assert.equal(executeCalls, 0);
});
