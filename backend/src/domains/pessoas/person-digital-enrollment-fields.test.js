const assert = require("node:assert/strict");
const test = require("node:test");

const { Person } = require("./person.entity.js");
const { toPersonDataFromRow, toPersonRowValues } = require("./person.mapper.js");
const { PersonRepository } = require("./person.repository.js");
const { PersonService } = require("./person.service.js");

test("Person keeps the new canonical fields nullable for legacy data", () => {
  const person = new Person({ name: { fullName: "Pessoa Legada" } });
  assert.equal(person.birthCity, null);
  assert.equal(person.birthState, null);
  assert.equal(person.nationality, null);
  assert.equal(person.bloodType, null);
  assert.deepEqual(person.toJSON(), {
    address: null,
    birthCity: null,
    birthDate: null,
    birthState: null,
    bloodType: null,
    contact: null,
    createdAt: null,
    documents: [],
    id: null,
    name: { fullName: "Pessoa Legada" },
    nationality: null,
    profiles: [],
    status: null,
    updatedAt: null,
  });
});

test("Person serializes the new canonical fields without inventing an enum", () => {
  const person = new Person({
    birthCity: "Goiania",
    birthState: "GO",
    bloodType: "O-",
    nationality: "Brasileira",
  });
  assert.deepEqual(person.toJSON(), {
    address: null,
    birthCity: "Goiania",
    birthDate: null,
    birthState: "GO",
    bloodType: "O-",
    contact: null,
    createdAt: null,
    documents: [],
    id: null,
    name: null,
    nationality: "Brasileira",
    profiles: [],
    status: null,
    updatedAt: null,
  });
});

test("mapper reads legacy nulls and maps canonical fields to physical columns", () => {
  const legacy = toPersonDataFromRow({ ativo: 1, id: "legacy", nome: "Legado" });
  assert.equal(legacy.birthCity, null);
  assert.equal(legacy.birthState, null);
  assert.equal(legacy.nationality, null);
  assert.equal(legacy.bloodType, null);

  const values = toPersonRowValues({
    birthCity: "Goiania",
    birthState: "GO",
    bloodType: "AB+",
    nationality: "Brasileira",
    nome: "Pessoa",
  });
  assert.deepEqual(
    {
      birth_city: values.birth_city,
      birth_state: values.birth_state,
      blood_type: values.blood_type,
      nationality: values.nationality,
    },
    {
      birth_city: "Goiania",
      birth_state: "GO",
      blood_type: "AB+",
      nationality: "Brasileira",
    },
  );
});

test("PersonService partial update preserves omitted fields and accepts explicit null", async () => {
  let updated;
  const current = {
    birthCity: "Goiania",
    birthState: "GO",
    bloodType: "O+",
    id: "person-1",
    name: { fullName: "Pessoa" },
    nationality: "Brasileira",
  };
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

  await service.update("person-1", { birthCity: "Anapolis" });
  assert.equal(updated.birthCity, "Anapolis");
  assert.equal(updated.birthState, "GO");
  assert.equal(updated.nationality, "Brasileira");
  assert.equal(updated.bloodType, "O+");

  await service.update("person-1", { bloodType: null });
  assert.equal(updated.bloodType, null);
  assert.equal(updated.birthCity, "Goiania");
});

test("PersonRepository writes and projects the four nullable columns", async () => {
  const calls = [];
  const repository = new PersonRepository({
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });
      if (/INSERT INTO people/u.test(sql)) return { affectedRows: 1 };
      return [
        {
          ativo: 1,
          birth_city: "Goiania",
          birth_state: "GO",
          blood_type: "O-",
          id: "person-1",
          nationality: "Brasileira",
          nome: "Pessoa",
        },
      ];
    },
  });

  const person = await repository.create({
    birthCity: "Goiania",
    birthState: "GO",
    bloodType: "O-",
    id: "person-1",
    nationality: "Brasileira",
    nome: "Pessoa",
  });
  const insert = calls.find((call) => /INSERT INTO people/u.test(call.sql));
  assert.deepEqual(insert.params.slice(20, 24), ["Goiania", "GO", "Brasileira", "O-"]);
  assert.equal(person.birthCity, "Goiania");
  assert.equal(person.birthState, "GO");
  assert.equal(person.nationality, "Brasileira");
  assert.equal(person.bloodType, "O-");
});
