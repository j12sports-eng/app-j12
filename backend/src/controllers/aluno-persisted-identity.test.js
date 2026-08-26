"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeAlunoPayload, persistAluno } = require("./alunos.controller.js");
const { persistPublicEnrollment } = require("./public-enrollments.controller.js");

const CHILD_TABLES = [
  "j12_alunos_responsaveis",
  "j12_alunos_enderecos",
  "j12_alunos_documentos",
  "j12_alunos_esportes",
  "j12_alunos_saude",
  "j12_alunos_estrategico",
];

function normalizeSql(sql) {
  return String(sql).replace(/\s+/gu, " ").trim();
}

class RecordingConnection {
  constructor(insertId) {
    this.insertId = insertId;
    this.calls = [];
  }

  async execute(sql, params = []) {
    const call = { sql: normalizeSql(sql), params: [...params] };
    this.calls.push(call);
    await Promise.resolve();

    if (call.sql.startsWith("INSERT INTO j12_alunos (")) {
      return [{ affectedRows: 1, insertId: this.insertId }];
    }

    if (call.sql.startsWith("UPDATE j12_alunos SET")) {
      return [{ affectedRows: 1 }];
    }

    if (call.sql.startsWith("SELECT numero_matricula FROM j12_alunos")) {
      return [[{ numero_matricula: "400" }]];
    }

    if (call.sql.includes("FROM j12_planos")) {
      return [[]];
    }

    return [{ affectedRows: 1 }];
  }

  findCall(prefix) {
    return this.calls.find((call) => call.sql.startsWith(prefix));
  }

  findCalls(prefix) {
    return this.calls.filter((call) => call.sql.startsWith(prefix));
  }
}

function buildAluno({ id, numeroMatricula = "20260826-158", status = "experimental" }) {
  return normalizeAlunoPayload({
    id,
    nome: "Aluno Identidade",
    numeroMatricula,
    matriculaEm: "2026-08-26",
    status,
  });
}

function assertRelatedTablesUse(connection, expectedAlunoId) {
  for (const tableName of CHILD_TABLES) {
    const call = connection.findCall(`INSERT INTO ${tableName} `);
    assert.ok(call, `esperava escrita em ${tableName}`);
    assert.equal(call.params[0], expectedAlunoId);
  }

  const registryCalls = connection.findCalls("INSERT INTO j12_matricula_numeros ");
  assert.ok(registryCalls.length > 0, "esperava escrita no registry");
  for (const call of registryCalls) {
    assert.equal(Number(call.params[1]), expectedAlunoId);
  }
}

test("CREATE ignora ID temporario, usa insertId em filhos e registry e retorna identidade persistida", async () => {
  const connection = new RecordingConnection(96);
  const aluno = buildAluno({ id: "adf41bf8fee9b" });

  const persisted = await persistAluno(connection, aluno);

  const insert = connection.findCall("INSERT INTO j12_alunos (");
  assert.ok(insert);
  assert.doesNotMatch(insert.sql, /INSERT INTO j12_alunos \( id,/u);
  assert.equal(insert.params.includes(aluno.id), false);
  assertRelatedTablesUse(connection, 96);
  assert.equal(persisted.id, 96);
  assert.equal(persisted.numeroMatricula, "20260826-158");
});

test("UPDATE preserva ID 95, nao executa INSERT de aluno e vincula todos os filhos ao existente", async () => {
  const connection = new RecordingConnection(999);
  const aluno = buildAluno({ id: "95", numeroMatricula: "20260826-157", status: "ativo" });

  const persisted = await persistAluno(connection, aluno, { existingAlunoId: 95 });

  assert.equal(connection.findCall("INSERT INTO j12_alunos ("), undefined);
  const update = connection.findCall("UPDATE j12_alunos SET");
  assert.ok(update);
  assert.equal(update.params.at(-1), 95);
  assertRelatedTablesUse(connection, 95);
  assert.equal(persisted.id, 95);
});

test("matricula publica usa insertId no registry e em j12_matriculas_publicas", async () => {
  const connection = new RecordingConnection(96);
  const matricula = {
    dadosAluno: {
      nomeCompleto: "Aluno Publico",
      dataNascimento: "2012-01-15",
      idade: "14",
      cpf: "",
      rg: "",
      sexo: "Masculino",
      colegio: "",
      periodoEscolar: "",
    },
    responsavel: {
      nomeCompleto: "Responsavel Publico",
      cpf: "12345678901",
      rg: "",
      whatsapp: "11999999999",
      email: "responsavel@example.com",
      parentesco: "Mae",
    },
    endereco: {},
    documentos: {},
    esportivas: {
      modalidades: ["Futsal"],
      unidades: ["Arena J12 | Pirituba"],
      horarios: ["18:00 - 19:00"],
      turmas: ["Sub-14"],
    },
    saude: {},
    estrategicas: {},
  };

  await persistPublicEnrollment(connection, {
    matricula,
    protocol: "J12-TESTE",
    enrollmentNumber: "20260826-158",
    enrollmentSequence: 158,
    submittedAt: "2026-08-26",
    rawSubmittedAt: "2026-08-26T12:00:00.000Z",
    createdAt: "2026-08-26 12:00:00",
  });

  assertRelatedTablesUse(connection, 96);
  const registryCalls = connection.findCalls("INSERT INTO j12_matricula_numeros ");
  assert.equal(registryCalls.length, 2);
  for (const call of registryCalls) {
    assert.doesNotMatch(String(call.params[1]), /^a[0-9a-f]{12}$/u);
  }

  const publicEnrollment = connection.findCall("INSERT INTO j12_matriculas_publicas ");
  assert.ok(publicEnrollment);
  assert.equal(publicEnrollment.params[3], 96);
});
