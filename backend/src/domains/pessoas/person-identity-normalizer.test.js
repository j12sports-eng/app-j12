const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PERSON_IDENTITY_ERROR_CODES,
  PERSON_IDENTITY_LIMITS,
  PersonIdentityNormalizationError,
  normalizeCpf,
  normalizeEmail,
  normalizePersonIdentityInput,
  normalizePhone,
} = require("./person-identity-normalizer.js");

function hasSafeError(error, code, field) {
  assert.ok(error instanceof PersonIdentityNormalizationError);
  assert.equal(error.code, code);
  assert.equal(error.field, field);
  assert.deepEqual(error.details, { field });
  return true;
}

test("logical absence is always null", () => {
  for (const normalize of [normalizeCpf, normalizeEmail, normalizePhone]) {
    for (const value of [undefined, null, "", "   "]) assert.equal(normalize(value), null);
  }
});

test("unsupported types are rejected without coercion or PII", () => {
  for (const normalize of [normalizeCpf, normalizeEmail, normalizePhone]) {
    assert.throws(
      () => normalize(123),
      (error) => {
        assert.equal(error.code, PERSON_IDENTITY_ERROR_CODES.VALUE_INVALID);
        assert.doesNotMatch(error.message, /123/);
        return true;
      },
    );
    assert.throws(() => normalize({ value: "secret" }), /Identificador de pessoa invalido/);
  }
});

test("CPF accepts known formatting and preserves leading zero", () => {
  assert.equal(normalizeCpf("12345678900"), "12345678900");
  assert.equal(normalizeCpf(" 123.456.789-00 "), "12345678900");
  assert.equal(normalizeCpf("012.345.678-90"), "01234567890");
});

test("CPF rejects letters, wrong length and overflow without truncation", () => {
  for (const value of ["123.456.789-0A", "1234567890", "123456789000"]) {
    assert.throws(
      () => normalizeCpf(value),
      (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.CPF_INVALID, "cpf"),
    );
  }
  assert.throws(
    () => normalizeCpf(" ".repeat(PERSON_IDENTITY_LIMITS.cpf) + "1"),
    (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.VALUE_TOO_LONG, "cpf"),
  );
});

test("CPF is syntactic and does not claim check-digit validation", () => {
  assert.equal(normalizeCpf("111.111.111-11"), "11111111111");
});

test("e-mail trims/lowercases while preserving aliases and dots", () => {
  assert.equal(
    normalizeEmail(" Pessoa.Teste+Alias@Exemplo.COM "),
    "pessoa.teste+alias@exemplo.com",
  );
});

test("e-mail rejects malformed, control-character and oversized input", () => {
  for (const value of [
    "sem-arroba.example",
    "a@@example.com",
    "a@example.com\nBcc:x@example.com",
    "a\u0000@example.com",
  ]) {
    assert.throws(
      () => normalizeEmail(value),
      (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.EMAIL_INVALID, "email"),
    );
  }
  assert.throws(
    () => normalizeEmail(`${"a".repeat(PERSON_IDENTITY_LIMITS.email)}@x.io`),
    (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.VALUE_TOO_LONG, "email"),
  );
});

test("phone removes known masks without adding country or area code", () => {
  assert.equal(normalizePhone("(11) 99999-9999"), "11999999999");
  assert.equal(normalizePhone("11999999999"), "11999999999");
  assert.equal(normalizePhone("99999-9999"), "999999999");
});

test("phone preserves explicit international prefix", () => {
  assert.equal(normalizePhone("+55 11 99999-9999"), "+5511999999999");
  assert.equal(normalizePhone("+1 (212) 555-0100"), "+12125550100");
});

test("phone rejects letters, extensions, unexpected characters and overflow", () => {
  for (const value of [
    "11 CALL-ME",
    "11999999999 ramal 2",
    "55/11/99999-9999",
    "++5511999999999",
  ]) {
    assert.throws(
      () => normalizePhone(value),
      (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.PHONE_INVALID, "phone"),
    );
  }
  assert.throws(
    () => normalizePhone("1".repeat(PERSON_IDENTITY_LIMITS.phone + 1)),
    (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.VALUE_TOO_LONG, "phone"),
  );
});

test("aggregate is pure, deterministic, frozen and ignores unknown fields", () => {
  const input = {
    celular: "+55 (11) 98888-7777",
    cpf: "012.345.678-90",
    email: " Shared+Family@Example.COM ",
    ignored: "unchanged",
    telefone: "(11) 3333-4444",
  };
  const snapshot = { ...input };
  const normalized = normalizePersonIdentityInput(input);
  assert.deepEqual(normalized, {
    celular: "+5511988887777",
    cpf: "01234567890",
    email: "shared+family@example.com",
    telefone: "1133334444",
  });
  assert.deepEqual(input, snapshot);
  assert.notEqual(normalized, input);
  assert.ok(Object.isFrozen(normalized));
  assert.deepEqual(normalizePersonIdentityInput(input), normalized);
  assert.deepEqual(normalizePersonIdentityInput({ unknown: "value" }), {
    celular: null,
    cpf: null,
    email: null,
    telefone: null,
  });
});

test("aggregate rejects non-object input", () => {
  for (const value of [null, undefined, [], "identity"]) {
    assert.throws(
      () => normalizePersonIdentityInput(value),
      (error) => hasSafeError(error, PERSON_IDENTITY_ERROR_CODES.VALUE_INVALID, "identity"),
    );
  }
});

test("errors never embed received PII", () => {
  assert.throws(
    () => normalizeEmail("Sensitive.Person@example.com\n"),
    (error) => {
      assert.doesNotMatch(error.message, /Sensitive|example\.com/i);
      assert.doesNotMatch(JSON.stringify(error.details), /Sensitive|example\.com/i);
      return true;
    },
  );
});
