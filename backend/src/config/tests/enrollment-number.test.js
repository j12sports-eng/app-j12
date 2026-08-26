"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ENROLLMENT_NUMBER_KINDS,
  MAX_ENROLLMENT_SEQUENCE,
  MIN_ENROLLMENT_SEQUENCE,
  allocateEnrollmentSequence,
  buildEnrollmentNumberPreview,
  classifyEnrollmentNumber,
  extractEnrollmentSequence,
  extractLegacyRegistrySequence,
  formatEnrollmentNumber,
  getModernEnrollmentRegistryState,
  partitionEnrollmentRowsForRegistry,
} = require("../enrollment-number.js");

class MemoryRegistryConnection {
  constructor(entries = []) {
    this.entries = new Map(entries.map((entry) => [entry.numero, { ...entry }]));
  }

  async execute(sql, params = []) {
    const normalizedSql = String(sql).replace(/\s+/gu, " ").trim();
    await Promise.resolve();

    if (
      normalizedSql.includes("FROM j12_matricula_numeros registry") &&
      normalizedSql.includes("LEFT JOIN j12_alunos")
    ) {
      const [minimum, maximum] = params;
      const rows = [...this.entries.values()].filter(
        (entry) => entry.numero >= minimum && entry.numero <= maximum,
      );
      return [rows];
    }

    if (normalizedSql.startsWith("UPDATE j12_matricula_numeros")) {
      const [candidate] = params;
      const entry = this.entries.get(candidate);
      if (!entry || (entry.status !== "inativo" && entry.status !== "excluido")) {
        return [{ affectedRows: 0 }];
      }

      this.entries.set(candidate, {
        ...entry,
        status: "reservado",
        aluno_id: null,
        alunoId: null,
        aluno_nome: null,
        numeroMatricula: null,
      });
      return [{ affectedRows: 1 }];
    }

    if (normalizedSql.startsWith("INSERT INTO j12_matricula_numeros")) {
      const [candidate] = params;
      if (this.entries.has(candidate)) {
        const error = new Error("duplicate sequence");
        error.code = "ER_DUP_ENTRY";
        throw error;
      }

      this.entries.set(candidate, {
        numero: candidate,
        status: "reservado",
        aluno_id: null,
        alunoId: null,
        aluno_nome: null,
        numeroMatricula: null,
      });
      return [{ affectedRows: 1 }];
    }

    throw new Error(`SQL inesperado no fake: ${normalizedSql}`);
  }
}

test("extractEnrollmentSequence extrai somente os digitos depois do hifen", () => {
  assert.equal(extractEnrollmentSequence("20260423-157"), 157);
  assert.equal(extractEnrollmentSequence("20251118-105"), 105);
  assert.equal(extractEnrollmentSequence("20250912-7"), 7);
  assert.notEqual(extractEnrollmentSequence("20260423-157"), 20260423157);
});

test("formatEnrollmentNumber usa a data efetiva e preserva round-trip", () => {
  assert.equal(formatEnrollmentNumber(158, "2026-08-25"), "20260825-158");

  const original = "20260423-157";
  assert.equal(formatEnrollmentNumber(extractEnrollmentSequence(original), "2026-04-23"), original);
});

test("identificadores numericos historicos sao preservados sem virar sequencia moderna", () => {
  assert.equal(extractEnrollmentSequence("157"), null);
  assert.equal(extractLegacyRegistrySequence("157"), 157);
  assert.equal(extractLegacyRegistrySequence(MIN_ENROLLMENT_SEQUENCE), 1);
  assert.equal(extractLegacyRegistrySequence(MAX_ENROLLMENT_SEQUENCE), 999999);
  assert.equal(extractLegacyRegistrySequence(2147483647), null);
  assert.equal(extractLegacyRegistrySequence("20260423157"), null);

  for (const identifier of ["1", "2", "12", "400"]) {
    assert.deepEqual(classifyEnrollmentNumber(identifier), {
      kind: ENROLLMENT_NUMBER_KINDS.HISTORICAL_NUMERIC,
      raw: identifier,
      sequence: null,
      historicalIdentifier: Number(identifier),
    });
    assert.equal(extractEnrollmentSequence(identifier), null);
  }

  const partition = partitionEnrollmentRowsForRegistry([
    ...["1", "2", "12", "400"].map((numero_matricula) => ({ numero_matricula })),
    { numero_matricula: "20260423-157" },
    { numero_matricula: "invalida" },
  ]);
  assert.deepEqual(
    partition.modernRows.map(({ sequence }) => sequence),
    [157],
  );
  assert.deepEqual(
    partition.historicalRows.map((row) => row.numero_matricula),
    ["1", "2", "12", "400"],
  );
  assert.equal(partition.invalidRows.length, 1);
});

test("valores vazios, zero, negativos e formatos inesperados falham fechados", () => {
  for (const value of [
    "",
    " ",
    null,
    undefined,
    "20260423-0",
    "20260423--1",
    "2026-04-23-157",
    "20260231-157",
    "ABC-157",
  ]) {
    assert.equal(extractEnrollmentSequence(value), null);
  }

  assert.throws(
    () => formatEnrollmentNumber(0, "2026-08-25"),
    (error) => error.code === "ENROLLMENT_SEQUENCE_INVALID",
  );
  assert.throws(
    () => formatEnrollmentNumber(-1, "2026-08-25"),
    (error) => error.code === "ENROLLMENT_SEQUENCE_INVALID",
  );
  assert.throws(
    () => formatEnrollmentNumber(158, "2026-08-25-invalida"),
    (error) => error.code === "ENROLLMENT_DATE_INVALID",
  );
});

test("preview apos 157 produz sequencia 158 e matricula publica completa", () => {
  const registryRows = [
    {
      numero: 157,
      status: "ativo",
      alunoId: "modern-157",
      numeroMatricula: "20260423-157",
    },
    { numero: 400, status: "ativo", alunoId: "legacy-400", numeroMatricula: "400" },
  ];
  const state = getModernEnrollmentRegistryState(registryRows);
  assert.equal(state.maxSequence, 157);
  assert.deepEqual(
    state.modernRows.map((row) => row.numero),
    [157],
  );

  const preview = buildEnrollmentNumberPreview({
    registryRows,
    effectiveDate: "2026-08-25",
  });

  assert.deepEqual(preview, {
    numeroMatricula: "20260825-158",
    sequence: 158,
    strategy: "sequential",
    reusedFrom: null,
  });
});

test("legado 400 e contaminacao nao determinam a proxima matricula", async () => {
  const connection = new MemoryRegistryConnection([
    {
      numero: 157,
      status: "ativo",
      alunoId: "modern-157",
      numeroMatricula: "20260423-157",
    },
    { numero: 400, status: "ativo", alunoId: "legacy-400", numeroMatricula: "400" },
    {
      numero: 2147483647,
      status: "ativo",
      alunoId: "contaminated",
      numeroMatricula: "2147483647",
    },
  ]);

  const reservation = await allocateEnrollmentSequence(connection);

  assert.equal(reservation.sequence, 158);
  assert.equal(connection.entries.get(400).status, "ativo");
  assert.equal(connection.entries.get(2147483647).status, "ativo");
});

test("alocacao concorrente resolve colisao sem reservar sequencia duplicada", async () => {
  const connection = new MemoryRegistryConnection([
    {
      numero: 157,
      status: "ativo",
      alunoId: "modern-157",
      numeroMatricula: "20260423-157",
    },
    { numero: 400, status: "ativo", alunoId: "legacy-400", numeroMatricula: "400" },
  ]);

  const reservations = await Promise.all([
    allocateEnrollmentSequence(connection),
    allocateEnrollmentSequence(connection),
  ]);

  assert.deepEqual(
    reservations.map((reservation) => reservation.sequence).sort((left, right) => left - right),
    [158, 159],
  );
});

test("sequencia inativa ou excluida continua reutilizavel de forma atomica", async () => {
  for (const status of ["inativo", "excluido"]) {
    const connection = new MemoryRegistryConnection([
      { numero: 1, status, alunoId: "legacy-1", numeroMatricula: "1" },
      {
        numero: 42,
        status,
        alunoId: "modern-42",
        numeroMatricula: "20250101-42",
      },
    ]);
    const reservation = await allocateEnrollmentSequence(connection);

    assert.equal(reservation.sequence, 42);
    assert.equal(reservation.strategy, "reused");
    assert.equal(reservation.reusedFrom, status);
    assert.equal(connection.entries.get(42).status, "reservado");
    assert.equal(connection.entries.get(1).status, status);
  }
});

test("estado sem nenhuma sequencia confiavel falha fechado", async () => {
  assert.throws(
    () =>
      buildEnrollmentNumberPreview({
        registryRows: [
          {
            numero: 2147483647,
            status: "ativo",
            alunoId: "contaminated",
            numeroMatricula: "2147483647",
          },
        ],
        effectiveDate: "2026-08-25",
      }),
    (error) => error.code === "ENROLLMENT_SEQUENCE_STATE_UNTRUSTED",
  );

  const connection = new MemoryRegistryConnection([
    {
      numero: 2147483647,
      status: "ativo",
      alunoId: "contaminated",
      numeroMatricula: "2147483647",
    },
  ]);
  await assert.rejects(
    allocateEnrollmentSequence(connection),
    (error) => error.code === "ENROLLMENT_SEQUENCE_STATE_UNTRUSTED",
  );
});
