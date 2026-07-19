const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { sanitizeUser } = require("../../../../../auth.js");
const {
  PRE_ENROLLMENT_HTTP_ERROR_CODES,
  readPreEnrollmentInput,
  resolveAuthenticatedPreEnrollmentContext,
} = require("../controllers/pre-enrollment.controller.js");
const {
  ensurePreEnrollmentInternalAccess,
} = require("../routes/pre-enrollment-internal.routes.js");

test("official authenticated user contract has no canonical unit claim", () => {
  const user = sanitizeUser({
    id: "admin-1",
    name: "Admin",
    role: "admin",
    status: "ativo",
    unitId: "untrusted-unit",
    unit_id: "untrusted-unit",
  });

  assert.equal(user.id, "admin-1");
  assert.equal(Object.hasOwn(user, "unitId"), false);
  assert.equal(Object.hasOwn(user, "unit_id"), false);
});

test("body, query and arbitrary headers cannot manufacture authenticated unit context", () => {
  const req = {
    auth: { id: "admin-1", role: "admin" },
    body: {},
    headers: {
      "x-unit-id": "attacker-unit",
      "x-unidade-id": "attacker-unit",
    },
    query: { unitId: "attacker-unit", unit_id: "attacker-unit" },
  };

  assert.throws(
    () => resolveAuthenticatedPreEnrollmentContext(req),
    (error) =>
      error.code === PRE_ENROLLMENT_HTTP_ERROR_CODES.UNIT_SCOPE_REQUIRED &&
      error.statusCode === 403,
  );
});

test("reserved authorization fields remain outside the pre-enrollment allowlist", () => {
  for (const field of [
    "isAdmin",
    "organizationId",
    "permissions",
    "role",
    "tenantId",
    "unitId",
    "userId",
  ]) {
    assert.throws(
      () => readPreEnrollmentInput({ body: { ...validBody(), [field]: "attacker-value" } }),
      (error) =>
        error.code === PRE_ENROLLMENT_HTTP_ERROR_CODES.INPUT_INVALID &&
        error.details.fields.includes(field),
    );
  }
});

test("global management authorization cannot replace missing unit authorization", () => {
  const req = { auth: { id: "admin-1", role: "admin" } };
  let continued = false;

  ensurePreEnrollmentInternalAccess(req, responseDouble(), () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(req.preEnrollmentAuthorization.granted, true);
  assert.throws(
    () => resolveAuthenticatedPreEnrollmentContext(req),
    (error) => error.code === PRE_ENROLLMENT_HTTP_ERROR_CODES.UNIT_SCOPE_REQUIRED,
  );
});

test("an explicitly supplied authenticated context is minimal and immutable", () => {
  const context = resolveAuthenticatedPreEnrollmentContext({
    auth: { id: "admin-1", role: "admin", unitId: "unit-1" },
    correlationId: "correlation-1",
    preEnrollmentAuthorization: Object.freeze({
      granted: true,
      policy: "FIXTURE_ONLY",
      scope: "PRE_ENROLLMENT_INTERNAL_CREATE",
    }),
  });

  assert.deepEqual(context, {
    authorization: {
      granted: true,
      policy: "FIXTURE_ONLY",
      scope: "PRE_ENROLLMENT_INTERNAL_CREATE",
    },
    correlationId: "correlation-1",
    unitId: "unit-1",
    userId: "admin-1",
  });
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(Object.keys(context).sort(), [
    "authorization",
    "correlationId",
    "unitId",
    "userId",
  ]);
});

test("server keeps the internal route unmounted while membership is unavailable", () => {
  const serverSource = readFileSync(path.resolve(__dirname, "../../../../server.js"), "utf8");

  assert.doesNotMatch(serverSource, /createPreEnrollmentInternalRouter/u);
  assert.doesNotMatch(serverSource, /PRE_ENROLLMENT_INTERNAL_ROUTE_BASE_PATH/u);
  assert.doesNotMatch(serverSource, /pre-enrollment-internal\.routes/u);
});

test("auth runtime schema defines no user-unit membership", () => {
  const schemaSource = readFileSync(
    path.resolve(
      __dirname,
      "../../../../database/migrations/20260712184500_create_auth_runtime_tables.sql",
    ),
    "utf8",
  );

  assert.doesNotMatch(schemaSource, /user_units|unit_users|memberships/iu);
  assert.doesNotMatch(schemaSource, /\b(unit_id|unidade_id)\b/iu);
});

function validBody() {
  return {
    enrollment: { startDate: "2026-07-20" },
    responsible: { nome: "Responsavel" },
    student: { dataNascimento: "2012-03-04", nome: "Aluno", sexo: "M" },
  };
}

function responseDouble() {
  return {
    json() {
      return this;
    },
    status() {
      return this;
    },
  };
}
