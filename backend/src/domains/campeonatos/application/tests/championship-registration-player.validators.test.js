const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  validateCreateRegistrationPlayerInput,
  validateRegistrationPlayerListInput,
  validateSetCaptainInput,
  validateUpdateRegistrationPlayerInput,
} = require("../validators/index.js");

test("validateCreateRegistrationPlayerInput normalizes roster player fields", () => {
  const values = validateCreateRegistrationPlayerInput({
    active: "sim",
    athleteId: "atl-global-1",
    birthDate: "2012-05-10",
    captain: "sim",
    document: "123456",
    name: "  Ana Souza  ",
    position: "Ala",
    shirtNumber: "10",
  });

  assert.deepEqual(values, {
    active: true,
    athleteId: "atl-global-1",
    birthDate: "2012-05-10",
    captain: true,
    document: "123456",
    name: "Ana Souza",
    position: "Ala",
    shirtNumber: 10,
  });
});

test("validateCreateRegistrationPlayerInput rejects invalid shirt number", () => {
  assert.throws(
    () => validateCreateRegistrationPlayerInput({ name: "Ana", shirtNumber: 0 }),
    /Numero da camisa invalido/,
  );
});

test("validateUpdateRegistrationPlayerInput keeps only provided fields", () => {
  const values = validateUpdateRegistrationPlayerInput({
    active: false,
    captain: false,
    position: "Pivo",
  });

  assert.deepEqual(values, {
    active: false,
    captain: false,
    position: "Pivo",
  });
});

test("validateRegistrationPlayerListInput prepares filters and pagination", () => {
  const values = validateRegistrationPlayerListInput({
    limit: 15,
    page: 2,
    position: "Ala",
    search: "ana",
    sortBy: "shirtNumber",
    sortDirection: "DESC",
    status: "ativo",
  });

  assert.deepEqual(values, {
    active: true,
    limit: 15,
    page: 2,
    position: "Ala",
    search: "ana",
    sortBy: "shirtNumber",
    sortDirection: "DESC",
  });
});

test("validateSetCaptainInput defaults captain action to true", () => {
  assert.deepEqual(validateSetCaptainInput({}), { captain: true });
  assert.deepEqual(validateSetCaptainInput({ captain: false }), { captain: false });
});
