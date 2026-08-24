"use strict";

const {
  AUTH_RUNTIME_CLASSIFICATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
} = require("../../auth-runtime-legacy-contract");
const AUTH_RUNTIME_CORRECTIVE_MIGRATION = "20260803133000_reconcile_auth_runtime_charset_collation";
const AUTH_RUNTIME_TABLES = Object.freeze(["users", "user_sessions", "password_reset_tokens"]);

const legacyColumns = Object.freeze({
  id: Object.freeze({
    position: 1,
    columnType: "int(11)",
    nullable: false,
    default: null,
    autoIncrement: true,
    extra: "auto_increment",
    charset: null,
    collation: null,
  }),
  nome: Object.freeze({
    position: 2,
    columnType: "varchar(150)",
    nullable: false,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
  email: Object.freeze({
    position: 3,
    columnType: "varchar(150)",
    nullable: false,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
  senha_hash: Object.freeze({
    position: 4,
    columnType: "varchar(255)",
    nullable: false,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
  perfil: Object.freeze({
    position: 5,
    columnType: "enum('admin','professor','responsavel','aluno')",
    nullable: false,
    default: "aluno",
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
  aluno_id: Object.freeze({
    position: 6,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),
  professor_id: Object.freeze({
    position: 7,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),
  responsavel_id: Object.freeze({
    position: 8,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),
  status: Object.freeze({
    position: 9,
    columnType: "enum('ativo','inativo')",
    nullable: true,
    default: "ativo",
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
  created_at: Object.freeze({
    position: 10,
    columnType: "timestamp",
    nullable: false,
    default: "CURRENT_TIMESTAMP",
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),
  updated_at: Object.freeze({
    position: 11,
    columnType: "timestamp",
    nullable: false,
    default: "CURRENT_TIMESTAMP",
    autoIncrement: false,
    extra: "on update CURRENT_TIMESTAMP",
    charset: null,
    collation: null,
  }),
});

const legacyIndexes = Object.freeze({
  email: Object.freeze({ unique: true, columns: Object.freeze(["email"]) }),
  idx_j12_usuarios_aluno: Object.freeze({ unique: false, columns: Object.freeze(["aluno_id"]) }),
  idx_j12_usuarios_perfil: Object.freeze({ unique: false, columns: Object.freeze(["perfil"]) }),
  idx_j12_usuarios_professor: Object.freeze({
    unique: false,
    columns: Object.freeze(["professor_id"]),
  }),
  idx_j12_usuarios_responsavel: Object.freeze({
    unique: false,
    columns: Object.freeze(["responsavel_id"]),
  }),
  PRIMARY: Object.freeze({ unique: true, columns: Object.freeze(["id"]) }),
});

const acceptedLegacyDifferences = Object.freeze([
  "id: int(11) AUTO_INCREMENT em vez de bigint unsigned AUTO_INCREMENT",
  "nome/email: varchar(150) em vez de varchar(191)",
  "perfil: ENUM legado em vez de varchar(50)",
  "aluno_id/professor_id/responsavel_id: int(11) em vez de varchar(64)",
  "status: ENUM nullable em vez de varchar(30) NOT NULL",
  "created_at/updated_at: timestamp em vez de datetime, preservando ON UPDATE",
  "indice unico legado email em vez do nome uniq_j12_usuarios_email",
  "utf8/utf8_unicode_ci em vez de utf8mb4/utf8mb4_unicode_ci",
]);

const authRuntimeBaselineAdoption = Object.freeze({
  version: "SPRINT_0_6_V1",
  decisionDate: "2026-08-03",
  migrationId: AUTH_RUNTIME_HISTORICAL_MIGRATION,
  migrationChecksum: "c50b48b4c2072991a8b135240fd97ca535889a2cf5d5b0f3dabab16723cd875e",
  role: AUTH_RUNTIME_CLASSIFICATION.legacyRole,
  classification: AUTH_RUNTIME_CLASSIFICATION.legacyAccess,
  acceptedState: "LEGACY_AUTH_STRUCTURE_ACCEPTED",
  requiredState: "LEGACY_AUTH_ADOPTION_REQUIRED",
  informationalReason: "AUDITED_LEGACY_AUTH_ADOPTION",
  relatedCanonicalTables: AUTH_RUNTIME_CLASSIFICATION.canonicalTables,
  legacyTable: Object.freeze({
    name: "j12_usuarios",
    engine: "InnoDB",
    charset: "utf8",
    collation: "utf8_unicode_ci",
    rowFormat: "Dynamic",
    createOptions: null,
    columns: legacyColumns,
    indexes: legacyIndexes,
    foreignKeys: Object.freeze({}),
  }),
  acceptedLegacyDifferences,
  acceptedTemporaryTableOptionDifferences: Object.freeze(
    ["j12_usuarios", ...AUTH_RUNTIME_TABLES].flatMap((table) => [
      Object.freeze({
        table,
        property: "charset",
        actual: "utf8",
        expected: "utf8mb4",
      }),
      Object.freeze({
        table,
        property: "collation",
        actual: "utf8_unicode_ci",
        expected: "utf8mb4_unicode_ci",
      }),
    ]),
  ),
  mandatoryCorrectiveMigrationId: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  legacyCharsetCorrection: "NOT_AUTHORIZED_PENDING_REAL_PREFLIGHT",
  requiredOrder: Object.freeze([
    AUTH_RUNTIME_HISTORICAL_MIGRATION,
    AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  ]),
  restrictions: Object.freeze([
    "NO_AUTOMATIC_ID_TYPE_CONVERSION",
    "NO_AUTOMATIC_ENUM_CONVERSION",
    "NO_AUTOMATIC_TIMESTAMP_CONVERSION",
    "NO_AUTOMATIC_UNIQUE_EMAIL_DDL",
    "NO_NEW_CANONICAL_REPOSITORY_DEPENDENCY_ON_J12_USUARIOS",
    "NO_DATA_COPY_WITHOUT_REAL_READ_ONLY_PREFLIGHT",
  ]),
  directCanonicalDependencies: "FORBIDDEN_OUTSIDE_AUTH_SOURCE_ADAPTER",
  deadline: "BEFORE_AUTH_RUNTIME_DEPENDENT_MIGRATIONS",
  justification:
    "Preserva IDs, ENUMs e semantica temporal consumidos pelo runtime legado enquanto users/auth_identities formam a fronteira canonica.",
  evidence:
    "Sprint 0.6: snapshot estatico e consumidores confirmam j12_usuarios como LEGACY_READ_WRITE; a adocao exige o shape legado exato.",
  tests: Object.freeze([
    "sprint-0-6-auth-runtime-legacy.test.js#1-11",
    "sprint-0-6-auth-runtime-legacy.test.js#12-22",
  ]),
});

module.exports = {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  AUTH_RUNTIME_TABLES,
  acceptedLegacyDifferences,
  authRuntimeBaselineAdoption,
  legacyColumns,
  legacyIndexes,
};
