const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { toPersonRowValues } = require("./person.mapper.js");
const { PersonRepository } = require("./person.repository.js");
const { PersonService } = require("./person.service.js");

test("modern create persists every original and normalized identity atomically", async () => {
  const calls = [];
  const repository = repositoryWithCalls(calls);
  await repository.create({
    celular: "+55 (11) 98888-7777",
    cpf: "012.345.678-90",
    email: " Person+tag@Example.COM ",
    id: "synthetic-person-create",
    nome: "Pessoa Sintetica",
    telefone: "(11) 3333-4444",
  });

  const insert = calls.find((call) => /^\s*INSERT INTO people/u.test(call.sql));
  assert.ok(insert);
  assert.match(insert.sql, /cpf,.*email,.*telefone,.*celular,/su);
  assert.match(
    insert.sql,
    /cpf_normalized,.*email_normalized,.*telefone_normalized,.*celular_normalized,/su,
  );
  assert.equal((insert.sql.match(/INSERT INTO people/gu) || []).length, 1);
  assert.deepEqual(insert.params.slice(16, 20), [
    "01234567890",
    "person+tag@example.com",
    "1133334444",
    "+5511988887777",
  ]);
});

test("modern create maps absent and invalid legacy identities to normalized null", async () => {
  const absentCalls = [];
  await repositoryWithCalls(absentCalls).create({ id: "absent", nome: "Pessoa Sem Documento" });
  assert.deepEqual(
    absentCalls.find((call) => /^\s*INSERT INTO people/u.test(call.sql)).params.slice(16, 20),
    [null, null, null, null],
  );

  const invalidCalls = [];
  await repositoryWithCalls(invalidCalls).create({
    cpf: "cpf-invalido",
    email: "email-invalido",
    id: "invalid",
    nome: "Pessoa Legada",
    telefone: "ramal 2",
  });
  const params = invalidCalls.find((call) => /^\s*INSERT INTO people/u.test(call.sql)).params;
  assert.equal(params[2], "cpf-invalido");
  assert.deepEqual(params.slice(16, 20), [null, null, null, null]);
});

test("repository update writes changed originals and normalizations in one parameterized statement", async () => {
  const calls = [];
  await repositoryWithCalls(calls).update("synthetic-update", {
    cpf: "987.654.321-00",
    email: " UPDATED@EXAMPLE.COM ",
    nome: "Pessoa Atualizada",
    telefone: "(21) 2222-3333",
  });
  const update = calls.find((call) => /^\s*UPDATE people/u.test(call.sql));
  assert.ok(update);
  assert.match(update.sql, /cpf = \?/u);
  assert.match(update.sql, /cpf_normalized = \?/u);
  assert.equal(update.params[6], "987.654.321-00");
  assert.equal(update.params[8], "UPDATED@EXAMPLE.COM");
  assert.equal(update.params[15], "(21) 2222-3333");
  assert.equal(update.params[16], "2122223333");
  assert.equal(update.params[18], "98765432100");
  assert.equal(update.params[19], "updated@example.com");
  assert.equal(update.params.at(-1), "synthetic-update");
});

test("explicit null clears original and normalized identity instead of restoring nested legacy value", async () => {
  const captured = [];
  const current = currentPerson();
  const service = new PersonService({
    repository: {
      async findById() {
        return current;
      },
      async update(id, next) {
        captured.push({ id, next });
        return next;
      },
    },
  });

  await service.update("synthetic-current", { cpf: null });
  assert.equal(captured[0].next.cpf, null);
  assert.equal(toPersonRowValues(captured[0].next).cpf, null);

  await service.update("synthetic-current", { contact: { email: null } });
  assert.equal(captured[1].next.email, null);
  assert.equal(toPersonRowValues(captured[1].next).email, null);
});

test("partial update preserves identity fields that are not in the patch", async () => {
  let updated;
  const current = currentPerson();
  const service = new PersonService({
    repository: {
      async findById() {
        return current;
      },
      async update(_id, next) {
        updated = next;
        return next;
      },
    },
  });
  await service.update("synthetic-current", { nome: "Nome Alterado" });
  assert.equal(updated.cpf, current.cpf);
  assert.equal(updated.email, current.email);
  assert.equal(updated.telefone, current.telefone);
  assert.equal(updated.celular, current.celular);
});

test("nested contact and CPF document patches update the flat persistence sources", async () => {
  const updates = [];
  const service = new PersonService({
    repository: {
      async findById() {
        return currentPerson();
      },
      async update(_id, next) {
        updates.push(next);
        return next;
      },
    },
  });
  await service.update("synthetic-current", {
    contact: { email: "new@example.com", mobilePhone: "+55 11 90000-0000" },
  });
  assert.equal(updates[0].email, "new@example.com");
  assert.equal(updates[0].celular, "+55 11 90000-0000");

  await service.update("synthetic-current", {
    documents: [{ type: "cpf", value: "111.222.333-44" }],
  });
  assert.equal(updates[1].cpf, "111.222.333-44");
});

test("flat identity fields take precedence over equivalent nested patches", async () => {
  let updated;
  const service = new PersonService({
    repository: {
      async findById() {
        return currentPerson();
      },
      async update(_id, next) {
        updated = next;
        return next;
      },
    },
  });

  await service.update("synthetic-current", {
    celular: "11944444444",
    email: "flat@example.com",
    telefone: "11933333333",
    contact: {
      email: "nested@example.com",
      mobilePhone: "11966666666",
      phone: "11955555555",
    },
  });

  assert.equal(updated.email, "flat@example.com");
  assert.equal(updated.telefone, "11933333333");
  assert.equal(updated.celular, "11944444444");
});

test("E2E direct writer imports the canonical normalizer and persists normalized contacts", () => {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/e2e/sprint-23-11-fixtures.cjs"),
    "utf8",
  );
  assert.match(fixture, /person-identity-normalizer\.js/u);
  assert.match(fixture, /email_normalized/u);
  assert.match(fixture, /telefone_normalized/u);
  assert.doesNotMatch(fixture, /replace\(\/\\D/u);
});

function repositoryWithCalls(calls) {
  return new PersonRepository({
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });
      if (/^\s*SELECT \*/u.test(sql)) return [];
      return { affectedRows: 1 };
    },
  });
}

function currentPerson() {
  return {
    celular: "+5511900000000",
    contact: {
      email: "old@example.com",
      mobilePhone: "+5511900000000",
      phone: "1133334444",
    },
    cpf: "01234567890",
    documents: [{ type: "cpf", value: "01234567890" }],
    email: "old@example.com",
    id: "synthetic-current",
    name: { displayName: "Pessoa Atual", fullName: "Pessoa Atual" },
    nome: "Pessoa Atual",
    telefone: "1133334444",
  };
}
