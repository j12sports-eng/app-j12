"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const legacy = require("../../migrations/20260729180000_enforce_enrollment_multiunit_invariants");
const multiunit = require("../../migrations/20260803123000_reconcile_enrollment_multiunit_invariants");
const invitation = require("../../migrations/20260803130000_reconcile_enrollment_digital_invitation_unit_type");
const ownership = require("../../migrations/20260803120000_prepare_enrollment_draft_ownership");

const LEGACY_TABLES = Object.freeze([
  "j12_alunos",
  "j12_matricula_numeros",
  "j12_matriculas_publicas",
]);

test("reconciliação multiunidade substitui índice legado uma vez e é idempotente", async () => {
  const fixture = createMultiunitFixture();
  const migration = createMultiunitMigration(fixture);

  await migration.up();
  const firstDdl = [...fixture.ddl];
  await migration.up();

  assert.ok(firstDdl.some((sql) => /DROP INDEX ux_enrollments_active_draft/iu.test(sql)));
  assert.ok(
    firstDdl.some(
      (sql) =>
        /ADD UNIQUE INDEX ux_enrollments_active_draft/iu.test(sql) &&
        /active_draft_unit_id/iu.test(sql),
    ),
  );
  assert.ok(firstDdl.some((sql) => /ADD UNIQUE INDEX ux_enrollments_current_unit/iu.test(sql)));
  assert.deepEqual(fixture.ddl, firstDdl);
  assert.equal((await migration.status()).reconciliationReady, true);
  assertNoLegacyReferences(fixture.calls);
});

test("estado já canônico produz zero DDL", async () => {
  const fixture = createMultiunitFixture({ canonical: true });
  await createMultiunitMigration(fixture).up();
  assert.deepEqual(fixture.ddl, []);
});

test("dados incompatíveis abortam antes de qualquer DDL", async () => {
  for (const diagnostic of [
    "activeDuplicateGroups",
    "currentConflictGroups",
    "draftDuplicateGroups",
    "incompleteModernOwnership",
    "orphanOwnership",
    "orphanUnits",
  ]) {
    const fixture = createMultiunitFixture({ diagnostics: { [diagnostic]: 1 } });
    await assert.rejects(
      () => createMultiunitMigration(fixture).up(),
      (error) => error.code === legacy.ERROR_CODES.DATA_UNSAFE,
    );
    assert.deepEqual(fixture.ddl, []);
  }
});

test("artefato incompatível nunca é mascarado ou substituído", async () => {
  const fixture = createMultiunitFixture();
  fixture.indexes.set(legacy.OLD_DRAFT_INDEX, {
    columns: ["student_person_id"],
    nonUnique: 0,
  });
  await assert.rejects(
    () => createMultiunitMigration(fixture).up(),
    (error) => error.code === multiunit.ERROR_CODES.SCHEMA_UNSAFE,
  );
  assert.deepEqual(fixture.ddl, []);
});

test("expressão generated semanticamente diferente bloqueia antes de DDL", async () => {
  const fixture = createMultiunitFixture({ canonical: true });
  fixture.columns.set(
    `enrollments.${legacy.DRAFT_UNIT_COLUMN}`,
    generated(
      "bigint",
      "CASE WHEN status = 'DRAFT' OR deleted_at IS NULL THEN unit_id ELSE NULL END",
    ),
  );
  await assert.rejects(
    () => createMultiunitMigration(fixture).up(),
    (error) => error.code === multiunit.ERROR_CODES.SCHEMA_UNSAFE,
  );
  assert.deepEqual(fixture.ddl, []);
});

test("tabela com registros compatíveis é aceita sem backfill ou DML", async () => {
  const fixture = createMultiunitFixture({
    diagnostics: { legacyWithoutUnit: 18, modernWithValidUnit: 24 },
  });
  await createMultiunitMigration(fixture).up();
  assert.equal(
    fixture.calls.some((call) => /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(call.sql)),
    false,
  );
});

test("down da reconciliação multiunidade falha fechado", async () => {
  await assert.rejects(
    () => createMultiunitMigration(createMultiunitFixture()).down(),
    (error) => error.code === multiunit.ERROR_CODES.DOWN_UNSAFE,
  );
});

test("correção de convite converte VARCHAR para signed BIGINT com FK e é idempotente", async () => {
  const fixture = createInvitationFixture();
  const migration = invitation.createInvitationUnitTypeReconciliation({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
  await migration.up();
  const firstDdl = [...fixture.ddl];
  await migration.up();
  assert.equal(fixture.column.COLUMN_TYPE, "bigint");
  assert.equal(fixture.column.DATA_TYPE, "bigint");
  assert.ok(firstDdl.some((sql) => /MODIFY COLUMN unit_id BIGINT NOT NULL/iu.test(sql)));
  assert.ok(firstDdl.some((sql) => /ADD CONSTRAINT fk_edi_unit/iu.test(sql)));
  assert.deepEqual(fixture.ddl, firstDdl);
  assertNoLegacyReferences(fixture.calls);
});

test("convite com unit_id não conversível ou órfão aborta antes de DDL", async () => {
  for (const values of [
    { invalid: 1, orphan: 0 },
    { invalid: 0, orphan: 1 },
  ]) {
    const fixture = createInvitationFixture(values);
    const migration = invitation.createInvitationUnitTypeReconciliation({
      queryRunner: fixture.query,
      tableExists: async (table) => fixture.tables.has(table),
    });
    await assert.rejects(
      () => migration.up(),
      (error) => error.code === invitation.ERROR_CODES.DATA_UNSAFE,
    );
    assert.deepEqual(fixture.ddl, []);
  }
});

test("convite bloqueia parent, índice ou FK incompatível antes da conversão", async () => {
  const fixtures = [
    createInvitationFixture({
      parentColumn: { DATA_TYPE: "bigint", COLUMN_TYPE: "bigint unsigned", IS_NULLABLE: "NO" },
    }),
    createInvitationFixture({ incompatibleIndex: true }),
    createInvitationFixture({ unexpectedForeignKey: true }),
  ];
  for (const fixture of fixtures) {
    const migration = invitation.createInvitationUnitTypeReconciliation({
      queryRunner: fixture.query,
      tableExists: async (table) => fixture.tables.has(table),
    });
    await assert.rejects(
      () => migration.up(),
      (error) => error.code === invitation.ERROR_CODES.SCHEMA_UNSAFE,
    );
    assert.deepEqual(fixture.ddl, []);
  }
});

test("down da correção de tipo falha fechado", async () => {
  const fixture = createInvitationFixture();
  const migration = invitation.createInvitationUnitTypeReconciliation({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
  await assert.rejects(
    () => migration.down(),
    (error) => error.code === invitation.ERROR_CODES.DOWN_UNSAFE,
  );
});

test("preparo de ownership adiciona colunas, índices e FKs uma vez", async () => {
  const fixture = createOwnershipFixture();
  const migration = ownership.createEnrollmentDraftOwnershipMigration({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
  await migration.up();
  const firstDdl = [...fixture.ddl];
  await migration.up();
  assert.equal(firstDdl.length, 9);
  assert.deepEqual(fixture.ddl, firstDdl);
  assert.equal(Object.keys(await migration.status()).length, 3);
  assertNoLegacyReferences(fixture.calls);
});

test("ownership órfão preexistente bloqueia antes de DDL", async () => {
  const fixture = createOwnershipFixture({
    preexisting: true,
    orphanColumn: "responsible_person_id",
  });
  const migration = ownership.createEnrollmentDraftOwnershipMigration({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
  await assert.rejects(
    () => migration.up(),
    (error) => error.code === ownership.ERROR_CODES.DATA_UNSAFE,
  );
  assert.deepEqual(fixture.ddl, []);
});

test("down do ownership falha fechado para preservar dados futuros", async () => {
  const fixture = createOwnershipFixture();
  const migration = ownership.createEnrollmentDraftOwnershipMigration({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
  await assert.rejects(
    () => migration.down(),
    (error) => error.code === ownership.ERROR_CODES.DOWN_UNSAFE,
  );
});

test("MySQL 5.7 isnull canonicalization is accepted without repeated DDL", async () => {
  const fixture = createMultiunitFixture({ canonical: true });
  fixture.columns.set(
    `enrollments.${legacy.DRAFT_UNIT_COLUMN}`,
    generated(
      "bigint",
      "(case when ((`status` = 'DRAFT') and isnull(`deleted_at`)) then `unit_id` else NULL end)",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_UNIT_COLUMN}`,
    generated(
      "bigint",
      "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `unit_id` else NULL end)",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_STUDENT_PERSON_COLUMN}`,
    generated(
      "varchar(64)",
      "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `student_person_id` else NULL end)",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_STUDENT_PROFILE_COLUMN}`,
    generated(
      "varchar(64)",
      "(case when ((`status` in ('DRAFT','ACTIVE')) and isnull(`deleted_at`)) then `student_profile_id` else NULL end)",
    ),
  );

  const migration = createMultiunitMigration(fixture);
  await migration.up();

  assert.equal((await migration.status()).reconciliationReady, true);
  assert.deepEqual(fixture.ddl, []);
});

test("MySQL 5.7 bigint(20) metadata is accepted for unit columns", async () => {
  const fixture = createMultiunitFixture({ canonical: true });
  fixture.columns.set("enrollments.unit_id", column("bigint(20)", "YES"));
  fixture.columns.set("j12_unidades.id", column("bigint(20)", "NO"));
  fixture.columns.set(
    `enrollments.${legacy.DRAFT_UNIT_COLUMN}`,
    generated(
      "bigint(20)",
      "CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_UNIT_COLUMN}`,
    generated(
      "bigint(20)",
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END",
    ),
  );

  const migration = createMultiunitMigration(fixture);
  await migration.up();

  assert.equal((await migration.status()).reconciliationReady, true);
  assert.deepEqual(fixture.ddl, []);
});

function createMultiunitMigration(fixture) {
  return multiunit.createEnrollmentMultiunitReconciliation({
    queryRunner: fixture.query,
    tableExists: async (table) => fixture.tables.has(table),
  });
}

function createMultiunitFixture({ canonical = false, diagnostics = {} } = {}) {
  const fixture = {
    calls: [],
    ddl: [],
    tables: new Set([
      "enrollments",
      "j12_unidades",
      "people",
      "person_profiles",
      "person_relationships",
    ]),
    columns: new Map(),
    indexes: new Map(),
    foreignKeys: [
      foreignKey("student_person_id", "people"),
      foreignKey("student_profile_id", "person_profiles"),
      foreignKey("responsible_person_id", "people"),
      foreignKey("responsible_profile_id", "person_profiles"),
      foreignKey("responsible_relationship_id", "person_relationships"),
      foreignKey("unit_id", "j12_unidades"),
    ],
    diagnostics: {
      activeDuplicateGroups: 0,
      currentConflictGroups: 0,
      draftDuplicateGroups: 0,
      draftDuplicateGroupsAcrossUnits: 0,
      incompleteModernOwnership: 0,
      legacyWithoutUnit: 3,
      modernWithValidUnit: 4,
      orphanOwnership: 0,
      orphanUnits: 0,
      ...diagnostics,
    },
  };
  for (const [name, type] of Object.entries({
    deleted_at: "datetime",
    responsible_person_id: "varchar(64)",
    responsible_profile_id: "varchar(64)",
    responsible_relationship_id: "varchar(64)",
    status: "varchar(32)",
    student_person_id: "varchar(64)",
    student_profile_id: "varchar(64)",
    unit_id: "bigint",
  })) {
    fixture.columns.set(`enrollments.${name}`, column(type, name === "unit_id" ? "YES" : "NO"));
  }
  fixture.columns.set("j12_unidades.id", column("bigint", "NO"));
  fixture.columns.set(
    "enrollments.active_draft_student_person_id",
    generated("varchar(64)", "CASE WHEN status = 'DRAFT' THEN student_person_id ELSE NULL END"),
  );
  fixture.columns.set(
    "enrollments.active_draft_student_profile_id",
    generated("varchar(64)", "CASE WHEN status = 'DRAFT' THEN student_profile_id ELSE NULL END"),
  );
  fixture.indexes.set(legacy.OLD_DRAFT_INDEX, {
    columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
    nonUnique: 0,
  });
  if (canonical) addCanonicalMultiunitArtifacts(fixture);

  const diagnosticSql = new Map(
    Object.entries(legacy.DIAGNOSTIC_QUERIES).map(([name, sql]) => [compact(sql), name]),
  );
  fixture.query = async (sql, params = []) => {
    const normalized = compact(sql);
    fixture.calls.push({ sql: normalized, params });
    if (/information_schema\.columns/iu.test(normalized)) {
      const value = fixture.columns.get(`${params[0]}.${params[1]}`);
      return value ? [value] : [];
    }
    if (/information_schema\.key_column_usage/iu.test(normalized)) return fixture.foreignKeys;
    if (/information_schema\.statistics/iu.test(normalized)) {
      const value = fixture.indexes.get(params[1]);
      return value ? [{ NON_UNIQUE: value.nonUnique, columns: value.columns.join(",") }] : [];
    }
    if (diagnosticSql.has(normalized))
      return [{ total: fixture.diagnostics[diagnosticSql.get(normalized)] }];
    if (/COUNT\(DISTINCT unit_id\)/iu.test(normalized))
      return [{ total: fixture.diagnostics.draftDuplicateGroupsAcrossUnits }];
    if (/^ALTER TABLE/iu.test(normalized)) {
      fixture.ddl.push(normalized);
      applyMultiunitDdl(fixture, normalized);
      return { affectedRows: 0 };
    }
    throw new Error(`SQL inesperado: ${normalized}`);
  };
  return fixture;
}

function addCanonicalMultiunitArtifacts(fixture) {
  fixture.columns.set(
    `enrollments.${legacy.DRAFT_UNIT_COLUMN}`,
    generated(
      "bigint",
      "CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_UNIT_COLUMN}`,
    generated(
      "bigint",
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_STUDENT_PERSON_COLUMN}`,
    generated(
      "varchar(64)",
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_person_id ELSE NULL END",
    ),
  );
  fixture.columns.set(
    `enrollments.${legacy.CURRENT_STUDENT_PROFILE_COLUMN}`,
    generated(
      "varchar(64)",
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_profile_id ELSE NULL END",
    ),
  );
  fixture.indexes.set(legacy.OLD_DRAFT_INDEX, {
    columns: multiunit.EXPECTED_DRAFT_INDEX,
    nonUnique: 0,
  });
  fixture.indexes.set(legacy.CURRENT_UNIQUE_INDEX, {
    columns: multiunit.EXPECTED_CURRENT_INDEX,
    nonUnique: 0,
  });
}

function applyMultiunitDdl(fixture, sql) {
  const addColumn = sql.match(/ADD COLUMN ([a-z0-9_]+) (BIGINT|VARCHAR\(64\))/iu);
  if (addColumn) {
    const expressions = {
      [legacy.DRAFT_UNIT_COLUMN]:
        "CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END",
      [legacy.CURRENT_UNIT_COLUMN]:
        "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END",
      [legacy.CURRENT_STUDENT_PERSON_COLUMN]:
        "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_person_id ELSE NULL END",
      [legacy.CURRENT_STUDENT_PROFILE_COLUMN]:
        "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_profile_id ELSE NULL END",
    };
    fixture.columns.set(
      `enrollments.${addColumn[1]}`,
      generated(addColumn[2].toLowerCase(), expressions[addColumn[1]]),
    );
    return;
  }
  const dropIndex = sql.match(/DROP INDEX ([a-z0-9_]+)/iu);
  if (dropIndex) {
    fixture.indexes.delete(dropIndex[1]);
    return;
  }
  const addIndex = sql.match(/ADD UNIQUE INDEX ([a-z0-9_]+) \((.+)\)/iu);
  if (addIndex) {
    fixture.indexes.set(addIndex[1], {
      columns: addIndex[2].split(",").map((value) => value.trim()),
      nonUnique: 0,
    });
  }
}

function createInvitationFixture({
  invalid = 0,
  orphan = 0,
  parentColumn = { DATA_TYPE: "bigint", COLUMN_TYPE: "bigint", IS_NULLABLE: "NO" },
  incompatibleIndex = false,
  unexpectedForeignKey = false,
} = {}) {
  const fixture = {
    calls: [],
    ddl: [],
    tables: new Set(["enrollment_digital_invitations", "j12_unidades"]),
    column: { DATA_TYPE: "varchar", COLUMN_TYPE: "varchar(64)", IS_NULLABLE: "NO" },
    parentColumn,
    index: incompatibleIndex
      ? { NON_UNIQUE: 0, columns: "unit_id,unexpected" }
      : { NON_UNIQUE: 1, columns: "unit_id" },
    foreignKeys: unexpectedForeignKey
      ? [
          {
            CONSTRAINT_NAME: "fk_unexpected",
            COLUMN_NAME: "unit_id",
            REFERENCED_TABLE_NAME: "other_units",
            REFERENCED_COLUMN_NAME: "id",
          },
        ]
      : [],
  };
  fixture.query = async (sql, params = []) => {
    const normalized = compact(sql);
    fixture.calls.push({ sql: normalized, params });
    if (/information_schema\.columns/iu.test(normalized))
      return [params[0] === "j12_unidades" ? fixture.parentColumn : fixture.column];
    if (/information_schema\.statistics/iu.test(normalized))
      return fixture.index ? [fixture.index] : [];
    if (/information_schema\.key_column_usage/iu.test(normalized)) return fixture.foreignKeys;
    if (/TRIM\(unit_id\)/iu.test(normalized)) return [{ total: invalid }];
    if (/LEFT JOIN j12_unidades/iu.test(normalized)) return [{ total: orphan }];
    if (/^ALTER TABLE/iu.test(normalized)) {
      fixture.ddl.push(normalized);
      if (/MODIFY COLUMN unit_id BIGINT/iu.test(normalized))
        fixture.column = { DATA_TYPE: "bigint", COLUMN_TYPE: "bigint", IS_NULLABLE: "NO" };
      if (/ADD INDEX idx_edi_unit/iu.test(normalized))
        fixture.index = { NON_UNIQUE: 1, columns: "unit_id" };
      if (/ADD CONSTRAINT fk_edi_unit/iu.test(normalized))
        fixture.foreignKeys = [
          {
            CONSTRAINT_NAME: "fk_edi_unit",
            COLUMN_NAME: "unit_id",
            REFERENCED_TABLE_NAME: "j12_unidades",
            REFERENCED_COLUMN_NAME: "id",
          },
        ];
      return { affectedRows: 0 };
    }
    throw new Error(`SQL inesperado: ${normalized}`);
  };
  return fixture;
}

function createOwnershipFixture({ preexisting = false, orphanColumn = null } = {}) {
  const fixture = {
    calls: [],
    ddl: [],
    tables: new Set(["enrollments", "people", "person_profiles", "person_relationships"]),
    columns: new Map(),
    indexes: new Map(),
    foreignKeys: new Map(),
  };
  if (preexisting) {
    for (const columnName of Object.keys(ownership.OWNERSHIP))
      fixture.columns.set(columnName, {
        COLUMN_TYPE: "varchar(64)",
        IS_NULLABLE: "YES",
        EXTRA: "",
      });
  }
  fixture.query = async (sql, params = []) => {
    const normalized = compact(sql);
    fixture.calls.push({ sql: normalized, params });
    if (/information_schema\.columns/iu.test(normalized)) {
      const value = fixture.columns.get(params[1]);
      return value ? [value] : [];
    }
    if (/information_schema\.statistics/iu.test(normalized)) {
      const value = fixture.indexes.get(params[1]);
      return value ? [{ NON_UNIQUE: value.nonUnique, columns: value.columns.join(",") }] : [];
    }
    if (/information_schema\.key_column_usage/iu.test(normalized)) {
      if (/constraint_name=\?/iu.test(normalized)) {
        const value = fixture.foreignKeys.get(params[1]);
        return value ? [ownershipForeignKeyRow(value)] : [];
      }
      return [...fixture.foreignKeys.values()]
        .filter((foreignKey) => foreignKey.column === params[1])
        .map(ownershipForeignKeyRow);
    }
    if (/^SELECT COUNT\(\*\) total FROM enrollments source/iu.test(normalized)) {
      const matched = Object.keys(ownership.OWNERSHIP).find((name) =>
        normalized.includes(`source.${name}`),
      );
      return [{ total: matched === orphanColumn ? 1 : 0 }];
    }
    if (/^ALTER TABLE/iu.test(normalized)) {
      fixture.ddl.push(normalized);
      const addColumn = normalized.match(/ADD COLUMN ([a-z0-9_]+) VARCHAR\(64\) NULL/iu);
      if (addColumn)
        fixture.columns.set(addColumn[1], {
          COLUMN_TYPE: "varchar(64)",
          IS_NULLABLE: "YES",
          EXTRA: "",
        });
      const addIndex = normalized.match(/ADD INDEX ([a-z0-9_]+) \(([a-z0-9_]+)\)/iu);
      if (addIndex) fixture.indexes.set(addIndex[1], { nonUnique: 1, columns: [addIndex[2]] });
      const addForeignKey = normalized.match(
        /ADD CONSTRAINT ([a-z0-9_]+) FOREIGN KEY \(([a-z0-9_]+)\) REFERENCES ([a-z0-9_]+)\(id\)/iu,
      );
      if (addForeignKey)
        fixture.foreignKeys.set(addForeignKey[1], {
          name: addForeignKey[1],
          column: addForeignKey[2],
          referencedTable: addForeignKey[3],
          referencedColumn: "id",
        });
      return { affectedRows: 0 };
    }
    throw new Error(`SQL inesperado: ${normalized}`);
  };
  return fixture;
}

function ownershipForeignKeyRow(value) {
  return {
    CONSTRAINT_NAME: value.name,
    COLUMN_NAME: value.column,
    REFERENCED_TABLE_NAME: value.referencedTable,
    REFERENCED_COLUMN_NAME: value.referencedColumn,
  };
}

function column(type, nullable) {
  return {
    DATA_TYPE: type.replace(/\(.+$/u, ""),
    COLUMN_TYPE: type,
    IS_NULLABLE: nullable,
    EXTRA: "",
    GENERATION_EXPRESSION: null,
  };
}

function generated(type, expression) {
  return {
    ...column(type, "YES"),
    EXTRA: "VIRTUAL GENERATED",
    GENERATION_EXPRESSION: expression,
  };
}

function foreignKey(columnName, tableName) {
  return {
    COLUMN_NAME: columnName,
    REFERENCED_COLUMN_NAME: "id",
    REFERENCED_TABLE_NAME: tableName,
  };
}

function compact(value) {
  return String(value).replace(/\s+/gu, " ").trim();
}

function assertNoLegacyReferences(calls) {
  const text = calls.map((call) => call.sql).join("\n");
  for (const table of LEGACY_TABLES) assert.doesNotMatch(text, new RegExp(table, "iu"));
}
