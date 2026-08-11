const assert = require("node:assert/strict");
const test = require("node:test");

const {
  NORMALIZED_COLUMNS,
  NORMALIZED_INDEXES,
  PEOPLE_IDENTITY_MIGRATION_ERRORS,
  auditRawCpfConflicts,
  backfillPeopleIdentity,
  createPeopleNormalizedIdentityMigration,
  down,
  normalizeBackfillRow,
  status,
  up,
} = require("../20260717220000_add_people_normalized_identity_columns.js");
const {
  CREATE_PEOPLE_TABLE_SQL,
  PersonRepository,
  withNormalizedIdentity,
} = require("../../../domains/pessoas/person.repository.js");

test("exports the up/down/status contract required by the canonical runner", () => {
  assert.equal(typeof up, "function");
  assert.equal(typeof down, "function");
  assert.equal(typeof status, "function");
});

test("backfill uses the canonical normalizer without truncating or inventing values", () => {
  const normalized = normalizeBackfillRow({
    celular: "+55 (11) 98888-7777",
    cpf: "012.345.678-90",
    email: "  ALIAS+tag@Example.COM ",
    telefone: "(11) 3333-4444",
  });
  assert.deepEqual(normalized.values, {
    celular_normalized: "+5511988887777",
    cpf_normalized: "01234567890",
    email_normalized: "alias+tag@example.com",
    telefone_normalized: "1133334444",
  });
  assert.deepEqual(normalized.invalidFields, []);

  const invalid = normalizeBackfillRow({ cpf: "123", email: "invalid", telefone: "ramal 2" });
  assert.equal(invalid.values.cpf_normalized, null);
  assert.equal(invalid.values.email_normalized, null);
  assert.equal(invalid.values.telefone_normalized, null);
  assert.deepEqual([...invalid.invalidFields].sort(), [
    "cpf_normalized",
    "email_normalized",
    "telefone_normalized",
  ]);
});

test("backfill is cursor-paginated, bounded, PII-safe and idempotent", async () => {
  const fake = createFakeDatabase({
    schemaReady: true,
    rows: [
      person("a", { cpf: "012.345.678-90", email: " A@EXAMPLE.COM " }),
      person("b", { telefone: "(11) 3333-4444" }),
      person("c", { celular: "+55 (11) 98888-7777" }),
    ],
  });
  const logs = [];
  const first = await backfillPeopleIdentity({
    batchSize: 2,
    logger: (entry) => logs.push(entry),
    queryRunner: fake.query,
  });
  assert.deepEqual(first, {
    batchesProcessed: 2,
    invalidRecords: 0,
    recordsNormalized: 3,
    recordsProcessed: 3,
    recordsSkipped: 0,
  });
  assert.deepEqual(
    fake.pageCalls.map((call) => call.params),
    [
      ["", 2],
      ["b", 2],
    ],
  );
  assert.doesNotMatch(JSON.stringify(logs), /01234567890|a@example|33334444|988887777/u);

  fake.pageCalls.length = 0;
  const second = await backfillPeopleIdentity({ batchSize: 2, queryRunner: fake.query });
  assert.equal(second.recordsNormalized, 0);
  assert.equal(second.recordsSkipped, 3);
});

test("backfill leaves invalid sources null and supports safe retry after an intermediate failure", async () => {
  const fake = createFakeDatabase({
    failUpdateOnceForId: "b",
    schemaReady: true,
    rows: [person("a", { cpf: "012.345.678-90" }), person("b", { cpf: "98765432100" })],
  });
  await assert.rejects(
    () => backfillPeopleIdentity({ batchSize: 1, queryRunner: fake.query }),
    /controlled update failure/u,
  );
  const resumed = await backfillPeopleIdentity({ batchSize: 1, queryRunner: fake.query });
  assert.equal(resumed.recordsProcessed, 2);
  assert.equal(resumed.recordsNormalized, 1);
  assert.equal(fake.rows[0].cpf_normalized, "01234567890");
  assert.equal(fake.rows[1].cpf_normalized, "98765432100");
});

test("up adds only nullable compatible columns and non-unique indexes", async () => {
  const fake = createFakeDatabase({
    rows: [
      person("a", { cpf: "012.345.678-90" }),
      person("b", { cpf: "98765432100" }),
      person("c", { email: "shared@example.com" }),
      person("d", { email: "shared@example.com" }),
    ],
  });
  const migration = createPeopleNormalizedIdentityMigration({ queryRunner: fake.query });
  const result = await migration.up({ batchSize: 2 });

  assert.deepEqual(Object.keys(fake.columns).sort(), Object.keys(NORMALIZED_COLUMNS).sort());
  assert.deepEqual(Object.keys(fake.indexes).sort(), Object.keys(NORMALIZED_INDEXES).sort());
  assert.equal(result.duplicateCpfGroups, 0);
  assert.equal(result.duplicateCpfRecords, 0);
  assert.equal(result.uniqueCpfConstraintCreated, false);
  assert.equal(
    fake.sql.some((sql) => /ADD UNIQUE|UNIQUE INDEX/iu.test(sql)),
    false,
  );
  assert.equal(
    fake.sql.some((sql) => /UPDATE people SET cpf\s*=/iu.test(sql)),
    false,
  );

  const repeated = await migration.up({ batchSize: 2 });
  assert.equal(repeated.backfill.recordsNormalized, 0);
});

test("up blocks normalized CPF duplicates before any schema or data write", async () => {
  const fake = createFakeDatabase({
    rows: [person("a", { cpf: "012.345.678-90" }), person("b", { cpf: "01234567890" })],
  });

  assert.deepEqual(await auditRawCpfConflicts({ queryRunner: fake.query }), {
    duplicateGroups: 1,
    duplicateRecords: 2,
  });
  await assert.rejects(
    createPeopleNormalizedIdentityMigration({ queryRunner: fake.query }).up(),
    (error) => error.code === PEOPLE_IDENTITY_MIGRATION_ERRORS.DUPLICATES_FOUND,
  );
  assert.deepEqual(fake.columns, {});
  assert.deepEqual(fake.indexes, {});
  assert.equal(
    fake.sql.some((sql) => /^(ALTER|UPDATE)\b/iu.test(sql)),
    false,
  );
});

test("up fails closed for a missing table or incompatible existing schema", async () => {
  const missing = createFakeDatabase({ tableExists: false });
  await assert.rejects(
    () => createPeopleNormalizedIdentityMigration({ queryRunner: missing.query }).up(),
    (error) => error.code === PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
  );

  const incompatible = createFakeDatabase({ schemaReady: true });
  incompatible.columns.cpf_normalized.CHARACTER_MAXIMUM_LENGTH = 10;
  await assert.rejects(
    () => createPeopleNormalizedIdentityMigration({ queryRunner: incompatible.query }).up(),
    (error) => error.code === PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
  );
});

test("up blocks an unapproved CPF unique and status reports it without exposing values", async () => {
  const fake = createFakeDatabase({ schemaReady: true, uniqueCpfConstraint: true });
  const migration = createPeopleNormalizedIdentityMigration({ queryRunner: fake.query });
  await assert.rejects(
    () => migration.up(),
    (error) => error.code === PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
  );
  const status = await migration.status();
  assert.equal(status.uniqueCpfConstraintActive, true);
});

test("status is aggregate and down blocks data loss", async () => {
  const fake = createFakeDatabase({
    schemaReady: true,
    rows: [person("a", { cpf: "012.345.678-90", cpf_normalized: "01234567890" })],
  });
  const migration = createPeopleNormalizedIdentityMigration({ queryRunner: fake.query });
  const status = await migration.status();
  assert.equal(status.tableExists, true);
  assert.equal(status.backfillPendingOrInvalid, 0);
  assert.equal(status.uniqueCpfConstraintActive, false);
  assert.doesNotMatch(JSON.stringify(status), /01234567890/u);
  await assert.rejects(
    () => migration.down(),
    (error) =>
      error.code === PEOPLE_IDENTITY_MIGRATION_ERRORS.DOWN_BLOCKED &&
      error.details.populatedRecords === 1,
  );
});

test("down removes only empty normalized structure", async () => {
  const fake = createFakeDatabase({ schemaReady: true });
  const result = await createPeopleNormalizedIdentityMigration({ queryRunner: fake.query }).down();
  assert.equal(result.removedEmptyColumns, true);
  assert.deepEqual(fake.columns, {});
  assert.deepEqual(fake.indexes, {});
});

test("modern repository writes original and normalized values atomically without resolving identity", async () => {
  const calls = [];
  const repository = new PersonRepository({
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });
      if (/SELECT \*/u.test(sql)) return [];
      return { affectedRows: 1 };
    },
  });
  await repository.create({
    cpf: "012.345.678-90",
    email: " PERSON@EXAMPLE.COM ",
    nome: "Pessoa Sintetica",
    telefone: "(11) 3333-4444",
  });
  const insert = calls.find((call) => /INSERT INTO people/u.test(call.sql));
  assert.match(insert.sql, /cpf_normalized/u);
  assert.deepEqual(insert.params.slice(16, 20), [
    "01234567890",
    "person@example.com",
    "1133334444",
    null,
  ]);
  assert.equal(
    calls.some((call) => /findByCpf|duplicate|merge/iu.test(call.sql)),
    false,
  );

  const legacyCompatible = withNormalizedIdentity({ cpf: "invalido", email: "invalido" });
  assert.equal(legacyCompatible.cpf_normalized, null);
  assert.equal(legacyCompatible.email_normalized, null);

  const oversizedSource = "valid@example.com".padEnd(192, "x");
  const mappedTruncated = oversizedSource.slice(0, 191);
  assert.equal(
    withNormalizedIdentity({ email: mappedTruncated }, { email: oversizedSource }).email_normalized,
    null,
  );
});

test("fresh-table DDL includes nullable normalized columns and never unique contacts", () => {
  for (const column of Object.keys(NORMALIZED_COLUMNS)) {
    assert.match(CREATE_PEOPLE_TABLE_SQL, new RegExp(`${column} VARCHAR\\(`));
  }
  assert.doesNotMatch(CREATE_PEOPLE_TABLE_SQL, /UNIQUE[^\n]*(email|telefone|celular)_normalized/iu);
});

test("down tolerates a partially applied empty schema", async () => {
  const fake = createFakeDatabase();
  fake.columns.cpf_normalized = columnMetadata("cpf_normalized");
  fake.indexes.idx_people_cpf_normalized = { NON_UNIQUE: 1, columns: "cpf_normalized" };
  await createPeopleNormalizedIdentityMigration({ queryRunner: fake.query }).down();
  assert.deepEqual(fake.columns, {});
  assert.deepEqual(fake.indexes, {});
});

function person(id, overrides = {}) {
  return {
    celular: null,
    celular_normalized: null,
    cpf: null,
    cpf_normalized: null,
    email: null,
    email_normalized: null,
    id,
    telefone: null,
    telefone_normalized: null,
    ...overrides,
  };
}

function createFakeDatabase({
  failUpdateOnceForId = null,
  rows = [],
  schemaReady = false,
  tableExists = true,
  uniqueCpfConstraint = false,
} = {}) {
  const state = {
    columns: {},
    failUpdateOnceForId,
    indexes: {},
    pageCalls: [],
    rows: rows.map((row) => ({ ...row })),
    sql: [],
    tableExists,
    uniqueCpfConstraint,
  };
  if (schemaReady) {
    for (const column of Object.keys(NORMALIZED_COLUMNS))
      state.columns[column] = columnMetadata(column);
    for (const [index, column] of Object.entries(NORMALIZED_INDEXES)) {
      state.indexes[index] = { NON_UNIQUE: 1, columns: column };
    }
  }

  state.query = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/gu, " ").trim();
    state.sql.push(compact);
    if (/information_schema\.tables/iu.test(compact)) return state.tableExists ? [{ 1: 1 }] : [];
    if (/information_schema\.columns/iu.test(compact))
      return state.columns[params[1]] ? [state.columns[params[1]]] : [];
    if (/SELECT DISTINCT INDEX_NAME FROM information_schema\.statistics/iu.test(compact))
      return state.uniqueCpfConstraint ? [{ INDEX_NAME: "external_unique" }] : [];
    if (/information_schema\.statistics/iu.test(compact))
      return state.indexes[params[1]] ? [state.indexes[params[1]]] : [];

    let match = /ADD COLUMN (\w+)/iu.exec(compact);
    if (match) {
      state.columns[match[1]] = columnMetadata(match[1]);
      for (const row of state.rows) row[match[1]] ??= null;
      return { affectedRows: 0 };
    }
    match = /ADD INDEX (\w+) \((\w+)\)/iu.exec(compact);
    if (match) {
      state.indexes[match[1]] = { NON_UNIQUE: 1, columns: match[2] };
      return { affectedRows: 0 };
    }
    match = /DROP INDEX (\w+)/iu.exec(compact);
    if (match) {
      delete state.indexes[match[1]];
      return { affectedRows: 0 };
    }
    match = /DROP COLUMN (\w+)/iu.exec(compact);
    if (match) {
      delete state.columns[match[1]];
      return { affectedRows: 0 };
    }
    if (/SELECT id, cpf(?:, email, telefone, celular)?/iu.test(compact)) {
      state.pageCalls.push({ params: [...params] });
      return state.rows.filter((row) => row.id > params[0]).slice(0, params[1]);
    }
    if (/UPDATE people SET/iu.test(compact)) {
      const id = String(params.at(-1));
      if (state.failUpdateOnceForId === id) {
        state.failUpdateOnceForId = null;
        throw new Error("controlled update failure");
      }
      const row = state.rows.find((candidate) => candidate.id === id);
      const columns = compact
        .slice(compact.indexOf(" SET ") + 5, compact.indexOf(" WHERE "))
        .split(",")
        .map((assignment) => assignment.trim().split(" ")[0]);
      columns.forEach((column, index) => {
        row[column] = params[index];
      });
      return { affectedRows: 1 };
    }
    if (/duplicate_groups/iu.test(compact)) {
      const counts = new Map();
      for (const row of state.rows) {
        if (row.cpf_normalized)
          counts.set(row.cpf_normalized, (counts.get(row.cpf_normalized) || 0) + 1);
      }
      const duplicates = [...counts.values()].filter((count) => count > 1);
      return [
        {
          duplicate_groups: duplicates.length,
          duplicate_records: duplicates.reduce((a, b) => a + b, 0),
        },
      ];
    }
    if (/NULLIF\(TRIM\(cpf\)/iu.test(compact)) {
      const total = state.rows.filter(
        (row) =>
          (String(row.cpf || "").trim() && !row.cpf_normalized) ||
          (String(row.email || "").trim() && !row.email_normalized) ||
          (String(row.telefone || "").trim() && !row.telefone_normalized) ||
          (String(row.celular || "").trim() && !row.celular_normalized),
      ).length;
      return [{ total }];
    }
    if (/SELECT COUNT\(\*\) total FROM people WHERE .*_normalized IS NOT NULL/iu.test(compact)) {
      const total = state.rows.filter((row) =>
        [
          row.cpf_normalized,
          row.email_normalized,
          row.telefone_normalized,
          row.celular_normalized,
        ].some(Boolean),
      ).length;
      return [{ total }];
    }
    throw new Error(`Unexpected SQL in fake: ${compact}`);
  };
  return state;
}

function columnMetadata(column) {
  return {
    CHARACTER_MAXIMUM_LENGTH:
      column === "cpf_normalized" ? 11 : column === "email_normalized" ? 191 : 50,
    DATA_TYPE: "varchar",
    IS_NULLABLE: "YES",
  };
}
