"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { syncEnrollmentNumberRegistry } = require("../db.js");
const {
  buildEnrollmentNumberPreview,
  isModernEnrollmentRegistryRow,
} = require("../enrollment-number.js");

function normalizeSql(sql) {
  return String(sql).replace(/\s+/gu, " ").trim();
}

function createSyncHarness({ studentRows, registryRows }) {
  const studentsById = new Map(studentRows.map((row) => [String(row.id), row]));
  const registry = new Map(registryRows.map((row) => [Number(row.numero), { ...row }]));
  const writes = [];
  let transactions = 0;

  const options = {
    tableExistsFn: async () => true,
    queryFn: async (sql) => {
      const normalizedSql = normalizeSql(sql);
      if (normalizedSql.includes("FROM j12_matricula_numeros registry")) {
        return [...registry.values()];
      }
      if (normalizedSql.includes("FROM j12_alunos")) {
        return studentRows.map((row) => ({ ...row }));
      }
      throw new Error(`SQL inesperado no fake: ${normalizedSql}`);
    },
    transactionFn: async (work) => {
      transactions += 1;
      return work({ fake: true });
    },
    upsertFn: async (_connection, entry) => {
      writes.push({ ...entry });
      const student = studentsById.get(String(entry.alunoId));
      registry.set(entry.enrollmentSequence, {
        numero: entry.enrollmentSequence,
        alunoId: String(entry.alunoId),
        alunoNome: entry.alunoNome,
        status: entry.status,
        numeroMatricula: student?.numero_matricula ?? null,
      });
    },
  };

  return {
    options,
    registry,
    writes,
    get transactions() {
      return transactions;
    },
  };
}

test("A. sync repara vinculo moderno quebrado quando a sequencia tem um unico aluno canonico", async () => {
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 95,
        numero_matricula: "20260826-158",
        nome_completo: "Aluno 158",
        status: "experimental",
      },
    ],
    registryRows: [
      {
        numero: 158,
        alunoId: "adf41bf8fee9b",
        alunoNome: "Aluno temporario",
        status: "experimental",
        numeroMatricula: null,
      },
    ],
  });

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.synced, 1);
  assert.equal(result.repairedModernLinks, 1);
  assert.equal(result.ignoredRegistryCollisions, 0);
  assert.equal(result.ambiguousModernConflicts, 0);
  assert.equal(harness.registry.get(158).alunoId, "95");
  assert.equal(harness.registry.get(158).alunoNome, "Aluno 158");
  assert.equal(harness.registry.get(158).status, "experimental");
});

test("B. depois do reparo, 157 ativo e 158 experimental produzem preview 159", async () => {
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 94,
        numero_matricula: "20260423-157",
        nome_completo: "Aluno 157",
        status: "ativo",
      },
      {
        id: 95,
        numero_matricula: "20260826-158",
        nome_completo: "Aluno 158",
        status: "experimental",
      },
    ],
    registryRows: [
      {
        numero: 157,
        alunoId: "94",
        alunoNome: "Aluno 157",
        status: "ativo",
        numeroMatricula: "20260423-157",
      },
      {
        numero: 158,
        alunoId: "temporario",
        alunoNome: "Aluno temporario",
        status: "experimental",
        numeroMatricula: null,
      },
    ],
  });

  await syncEnrollmentNumberRegistry(harness.options);
  const preview = buildEnrollmentNumberPreview({
    registryRows: [...harness.registry.values()],
    effectiveDate: "2026-08-26",
  });

  assert.deepEqual(preview, {
    numeroMatricula: "20260826-159",
    sequence: 159,
    strategy: "sequential",
    reusedFrom: null,
  });
});

test("C. registry e aluno historicos 400 continuam fora do estado moderno", async () => {
  const historicalRegistryRow = {
    numero: 400,
    alunoId: "40",
    alunoNome: "Aluno historico",
    status: "ativo",
    numeroMatricula: "400",
  };
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 40,
        numero_matricula: "400",
        nome_completo: "Aluno historico",
        status: "ativo",
      },
    ],
    registryRows: [historicalRegistryRow],
  });

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.ignoredHistorical, 1);
  assert.equal(result.synced, 0);
  assert.equal(harness.writes.length, 0);
  assert.equal(isModernEnrollmentRegistryRow(historicalRegistryRow), false);
});

test("D. valor contaminado 2147483647 permanece invalido e ignorado", async () => {
  const contaminatedRegistryRow = {
    numero: 2147483647,
    alunoId: "41",
    alunoNome: "Aluno contaminado",
    status: "ativo",
    numeroMatricula: "2147483647",
  };
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 41,
        numero_matricula: "2147483647",
        nome_completo: "Aluno contaminado",
        status: "ativo",
      },
    ],
    registryRows: [contaminatedRegistryRow],
  });

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.ignoredInvalid, 1);
  assert.equal(result.synced, 0);
  assert.equal(harness.writes.length, 0);
  assert.equal(isModernEnrollmentRegistryRow(contaminatedRegistryRow), false);
});

test("E. duas matriculas modernas na mesma sequencia reportam conflito e nao sobrescrevem", async () => {
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 95,
        numero_matricula: "20260826-158",
        nome_completo: "Aluno A",
        status: "experimental",
      },
      {
        id: 96,
        numero_matricula: "20260825-158",
        nome_completo: "Aluno B",
        status: "ativo",
      },
    ],
    registryRows: [
      {
        numero: 158,
        alunoId: "temporario",
        alunoNome: "Aluno temporario",
        status: "experimental",
        numeroMatricula: null,
      },
    ],
  });

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.synced, 0);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "no-safe-entries");
  assert.equal(result.repairedModernLinks, 0);
  assert.equal(result.ambiguousModernConflicts, 1);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.registry.get(158).alunoId, "temporario");
});

test("F. reserva valida sem aluno continua moderna e pode receber o vinculo canonico", async () => {
  const reservedRegistryRow = {
    numero: 158,
    alunoId: null,
    alunoNome: null,
    status: "reservado",
    numeroMatricula: null,
  };
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 95,
        numero_matricula: "20260826-158",
        nome_completo: "Aluno 158",
        status: "experimental",
      },
    ],
    registryRows: [reservedRegistryRow],
  });

  assert.equal(isModernEnrollmentRegistryRow(reservedRegistryRow), true);

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.synced, 1);
  assert.equal(result.repairedModernLinks, 0);
  assert.equal(result.ignoredRegistryCollisions, 0);
  assert.equal(harness.registry.get(158).alunoId, "95");
});

test("colisao historica verdadeira permanece protegida mesmo com candidato moderno unico", async () => {
  const harness = createSyncHarness({
    studentRows: [
      {
        id: 40,
        numero_matricula: "158",
        nome_completo: "Aluno historico",
        status: "ativo",
      },
      {
        id: 95,
        numero_matricula: "20260826-158",
        nome_completo: "Aluno moderno",
        status: "experimental",
      },
    ],
    registryRows: [
      {
        numero: 158,
        alunoId: "40",
        alunoNome: "Aluno historico",
        status: "ativo",
        numeroMatricula: "158",
      },
    ],
  });

  const result = await syncEnrollmentNumberRegistry(harness.options);

  assert.equal(result.synced, 0);
  assert.equal(result.ignoredHistorical, 1);
  assert.equal(result.ignoredRegistryCollisions, 1);
  assert.equal(result.repairedModernLinks, 0);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.registry.get(158).alunoId, "40");
});
