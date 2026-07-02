const { Person } = require("./person.entity.js");

/**
 * @typedef {Object} PersonPersistenceData
 * @property {string|null} [id]
 * @property {string|null} [nome]
 * @property {string|null} [cpf]
 * @property {string|null} [rg]
 * @property {string|null} [sexo]
 * @property {string|null} [dataNascimento]
 * @property {string|null} [email]
 * @property {string|null} [telefone]
 * @property {string|null} [celular]
 * @property {string|null} [cep]
 * @property {string|null} [logradouro]
 * @property {string|null} [numero]
 * @property {string|null} [bairro]
 * @property {string|null} [cidade]
 * @property {string|null} [estado]
 * @property {string|null} [complemento]
 * @property {boolean} [ativo]
 * @property {string|null} [createdAt]
 * @property {string|null} [updatedAt]
 */

/**
 * Maps plain Person data into the existing Person entity.
 *
 * This mapper does not read legacy models and is not connected to current
 * aluno, professor, responsavel or usuario payloads.
 *
 * @param {import("./person.types.js").PersonData} [data]
 * @returns {Person}
 */
function toPersonEntity(data = {}) {
  return new Person(data);
}

/**
 * Maps a Person entity or plain data into a serializable object.
 *
 * @param {Person|import("./person.types.js").PersonData} person
 * @returns {import("./person.types.js").PersonData}
 */
function toPersonData(person) {
  if (person instanceof Person) {
    return person.toJSON();
  }

  return new Person(person || {}).toJSON();
}

/**
 * Maps a database row from `people` into a persistence DTO and keeps the
 * previous architecture shape available for future adapters.
 *
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {(PersonPersistenceData & import("./person.types.js").PersonData)|null}
 */
function toPersonDataFromRow(row) {
  if (!row) return null;

  const persistenceData = {
    ativo: normalizeBoolean(row.ativo),
    bairro: row.bairro ?? null,
    celular: row.celular ?? null,
    cep: row.cep ?? null,
    cidade: row.cidade ?? null,
    complemento: row.complemento ?? null,
    cpf: row.cpf ?? null,
    createdAt: row.created_at ?? null,
    dataNascimento: row.data_nascimento ?? null,
    email: row.email ?? null,
    estado: row.estado ?? null,
    id: row.id ?? null,
    logradouro: row.logradouro ?? null,
    nome: row.nome ?? null,
    numero: row.numero ?? null,
    rg: row.rg ?? null,
    sexo: row.sexo ?? null,
    telefone: row.telefone ?? null,
    updatedAt: row.updated_at ?? null,
  };

  return {
    ...persistenceData,
    address: {
      city: persistenceData.cidade,
      complement: persistenceData.complemento,
      district: persistenceData.bairro,
      number: persistenceData.numero,
      state: persistenceData.estado,
      street: persistenceData.logradouro,
      zipCode: persistenceData.cep,
    },
    birthDate: persistenceData.dataNascimento,
    contact: {
      email: persistenceData.email,
      mobilePhone: persistenceData.celular,
      phone: persistenceData.telefone,
    },
    documents: [
      buildDocument("cpf", persistenceData.cpf),
      buildDocument("rg", persistenceData.rg),
    ].filter(Boolean),
    name: {
      displayName: persistenceData.nome,
      fullName: persistenceData.nome,
    },
    profiles: [],
    status: persistenceData.ativo ? "ativo" : "inativo",
  };
}

/**
 * Maps Person data into `people` column values.
 *
 * The mapper accepts the new flat Pessoa payload and the previously modeled
 * architecture shape so this persistence layer remains backward compatible.
 *
 * @param {(PersonPersistenceData & Partial<import("./person.types.js").PersonData>)} data
 * @returns {Record<string, unknown>}
 */
function toPersonRowValues(data = {}) {
  const cpf = readDocument(data, "cpf");
  const rg = readDocument(data, "rg");
  const active = data.ativo ?? data.status !== "inativo";

  return {
    ativo: active ? 1 : 0,
    bairro: nullableText(data.bairro ?? data.address?.district, 191),
    celular: nullableText(data.celular ?? data.contact?.mobilePhone, 50),
    cep: nullableText(data.cep ?? data.address?.zipCode, 20),
    cidade: nullableText(data.cidade ?? data.address?.city, 191),
    complemento: nullableText(data.complemento ?? data.address?.complement, 191),
    cpf: nullableText(data.cpf ?? cpf, 20),
    data_nascimento: nullableDate(data.dataNascimento ?? data.birthDate),
    email: nullableText(data.email ?? data.contact?.email, 191),
    estado: nullableText(data.estado ?? data.address?.state, 50),
    id: nullableText(data.id, 64),
    logradouro: nullableText(data.logradouro ?? data.address?.street, 191),
    nome: text(data.nome ?? data.name?.fullName ?? data.name?.displayName, 191),
    numero: nullableText(data.numero ?? data.address?.number, 30),
    rg: nullableText(data.rg ?? rg, 30),
    sexo: nullableText(data.sexo, 30),
    telefone: nullableText(data.telefone ?? data.contact?.phone, 50),
  };
}

/**
 * @param {string} type
 * @param {unknown} value
 * @returns {{ type: string, value: string }|null}
 */
function buildDocument(type, value) {
  const normalized = nullableText(value, 30);
  return normalized ? { type, value: normalized } : null;
}

/**
 * @param {Partial<import("./person.types.js").PersonData>} data
 * @param {string} type
 * @returns {string|null}
 */
function readDocument(data, type) {
  if (!Array.isArray(data.documents)) return null;
  const document = data.documents.find((item) => item?.type === type);
  return document?.value ?? null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1";
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableDate(value) {
  const normalized = nullableText(value, 10);
  return normalized || null;
}

module.exports = {
  toPersonDataFromRow,
  toPersonRowValues,
  toPersonData,
  toPersonEntity,
};
